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
    return await build_execution_feed(db, _org_id(current_user))


@router.get("/financial-state", response_model=FinancialStateBundle)
async def get_financial_state_bundle(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Канонический снимок финансового состояния организации (Flow 6)."""
    fs, predictions = await derive_financial_state(db, _org_id(current_user))
    return FinancialStateBundle(
        state=fs,
        default_autonomy_mode=infer_autonomy_mode(fs),
        predictions=predictions,
    )


@router.post("/work-packs/{pack_id}/ack", response_model=WorkPackAckResponse)
async def acknowledge_work_pack(
    pack_id: str,
    current_user: User = Depends(get_current_user),
):
    """Фиксация намерения по пакету (без автопроведения в ERP). Мобильный свайп / десктоп-кнопка."""
    _ = current_user
    return WorkPackAckResponse(pack_id=pack_id)
