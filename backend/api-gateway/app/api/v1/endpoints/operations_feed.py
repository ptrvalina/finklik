"""Операционная лента исполнения FinClick (Flow 4)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, workspace_organization_id
from app.models.user import User
from app.schemas.financial_state import FinancialStateBundle
from app.schemas.operations_feed import ExecutionFeedResponse, WorkPackAckResponse
from app.services.financial_state_service import derive_financial_state, infer_autonomy_mode
from app.services.operations_feed_service import build_execution_feed
from app.schemas.flow10_trust import TrustSurfaceResponse
from app.services.state_truth_governance_service import (
    assess_truth_governance,
    financial_state_fingerprint,
    load_recent_audit_entries,
    persist_state_audit_if_changed,
)
from app.services.trust_surface_service import build_trust_surface

router = APIRouter(
    prefix="/operations",
    tags=["operations-feed"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)


def _org_id(user: User) -> str:
    oid = workspace_organization_id(user)
    if not oid:
        raise HTTPException(status_code=400, detail="Нет организации")
    return oid


@router.get("/execution-feed", response_model=ExecutionFeedResponse)
async def get_execution_feed(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Единая лента «что сделать сегодня»: производная от FinancialState + операционные сигналы."""
    return await build_execution_feed(db, _org_id(current_user), current_user)


@router.get("/financial-state", response_model=FinancialStateBundle)
async def get_financial_state_bundle(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Канонический снимок финансового состояния + правила истины и аудит (Flow 6–7)."""
    oid = _org_id(current_user)
    fs, predictions = await derive_financial_state(db, oid)
    tg = await assess_truth_governance(db, oid, fs)
    await persist_state_audit_if_changed(db, oid, fs)
    audit_tail = await load_recent_audit_entries(db, oid, limit=8)
    return FinancialStateBundle(
        state=fs,
        state_fingerprint=financial_state_fingerprint(fs),
        default_autonomy_mode=infer_autonomy_mode(fs),
        predictions=predictions,
        truth_governance=tg,
        recent_state_audit=audit_tail,
    )


@router.get("/trust-surface", response_model=TrustSurfaceResponse)
async def get_trust_surface(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Flow 10: спокойные индикаторы надёжности и фоновых работ (без внутренних имён инфраструктуры)."""
    oid = _org_id(current_user)
    fs, _pred = await derive_financial_state(db, oid)
    return await build_trust_surface(db, oid, fs)


@router.post("/work-packs/{pack_id}/ack", response_model=WorkPackAckResponse)
async def acknowledge_work_pack(
    pack_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Фиксация намерения по пакету (без автопроведения в ERP). Мобильный свайп / десктоп-кнопка."""
    from app.events.bootstrap import get_event_store
    from app.events.constants import EV_WORK_PACK_ACKNOWLEDGED

    oid = _org_id(current_user)
    store = get_event_store()
    await store.append(
        db,
        organization_id=oid,
        event_type=EV_WORK_PACK_ACKNOWLEDGED,
        actor=str(current_user.id),
        target_id=pack_id,
        target_kind="work_pack",
        payload={"pack_id": pack_id},
        idempotency_key=f"WorkPackAck:{pack_id}:{current_user.id}"[:128],
    )
    await db.commit()
    return WorkPackAckResponse(pack_id=pack_id)
