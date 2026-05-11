"""Чтение журнала domain_events и превью производных данных (гибридный режим)."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, workspace_organization_id
from app.events.bootstrap import get_event_store
from app.events.constants import EV_AI_INSIGHT
from app.models.user import User
from app.schemas.domain_events import DerivedStatePreview, DomainEventOut
from app.services.business_state_service import compute_business_state


def _org_id(user: User) -> str:
    return workspace_organization_id(user) or ""


router = APIRouter(
    prefix="/events",
    tags=["domain-events"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)


@router.get("/recent", response_model=list[DomainEventOut])
async def list_recent_events(
    limit: int = Query(80, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    if not oid:
        return []
    store = get_event_store()
    rows = await store.query_recent(db, oid, limit=limit)
    out: list[DomainEventOut] = []
    for r in rows:
        try:
            payload = json.loads(r.payload_json or "{}")
        except json.JSONDecodeError:
            payload = {}
        out.append(
            DomainEventOut(
                id=r.id,
                event_type=r.event_type,
                actor=r.actor,
                target_id=r.target_id,
                target_kind=r.target_kind,
                payload=payload,
                occurred_at_ms=r.occurred_at_ms,
            )
        )
    return out


@router.get("/derived-preview", response_model=DerivedStatePreview)
async def derived_preview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = _org_id(current_user)
    if not oid:
        raise HTTPException(status_code=400, detail="Нет организации")
    bs = await compute_business_state(db, oid)
    store = get_event_store()
    insight_rows = await store.query_by_type(db, oid, EV_AI_INSIGHT, limit=20)
    insights: list[DomainEventOut] = []
    for r in insight_rows:
        try:
            payload = json.loads(r.payload_json or "{}")
        except json.JSONDecodeError:
            payload = {}
        insights.append(
            DomainEventOut(
                id=r.id,
                event_type=r.event_type,
                actor=r.actor,
                target_id=r.target_id,
                target_kind=r.target_kind,
                payload=payload,
                occurred_at_ms=r.occurred_at_ms,
            )
        )
    return DerivedStatePreview(business_state=bs, insights=insights)
