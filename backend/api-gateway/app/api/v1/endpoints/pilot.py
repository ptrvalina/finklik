"""Пилотные шаблоны организаций и лёгкая аналитика."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, workspace_organization_id
from app.models.user import User
from app.services.pilot_analytics_service import pilot_friction_summary, track_pilot_event
from app.services.pilot_seed_service import seed_pilot_industry

router = APIRouter(prefix="/pilot", tags=["pilot"])


class PilotSeedRequest(BaseModel):
    template: str = Field(pattern="^(retail|it|services|horeca|logistics)$")


@router.post("/seed-template")
async def seed_template(
    body: PilotSeedRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(403, "Только владелец может применять пилотный шаблон")
    result = await seed_pilot_industry(db, oid, body.template, actor=str(current_user.id))
    await db.commit()
    return result


class PilotTrackBody(BaseModel):
    event_name: str = Field(min_length=1, max_length=64)
    payload: dict | None = None


@router.post("/analytics/track")
async def track_event(
    body: PilotTrackBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    oid = workspace_organization_id(current_user)
    await track_pilot_event(
        db,
        organization_id=oid,
        user_id=str(current_user.id),
        event_name=body.event_name,
        payload=body.payload,
    )
    await db.commit()
    return {"ok": True}


@router.get("/analytics/friction")
async def friction_summary(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    return await pilot_friction_summary(db, oid, days=days)
