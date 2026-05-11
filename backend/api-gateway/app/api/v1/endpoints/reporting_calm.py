"""Спокойный операционный слой отчётности: готовность, проверки, шкала времени, события."""

from __future__ import annotations

from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, workspace_organization_id
from app.events.emit import emit_report_preparation_started, emit_report_validated
from app.models.user import User
from app.schemas.reporting_calm import ReportingCalmOverview
from app.services.reporting_calm_service import build_reporting_calm_overview

router = APIRouter(
    prefix="/reporting",
    tags=["reporting-calm"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)


def _oid(user: User) -> str:
    oid = workspace_organization_id(user)
    if not oid:
        raise HTTPException(status_code=400, detail="Нет организации")
    return oid


class ReportingPreparationBody(BaseModel):
    period: str | None = Field(None, description="Например 2026-Q1")


@router.get("/calm/overview", response_model=ReportingCalmOverview)
async def reporting_calm_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Единая проекция: готовность, проверки, обязательства, шкала времени (без побочных событий)."""
    return await build_reporting_calm_overview(db, _oid(current_user))


@router.post("/calm/preparation/start")
async def reporting_preparation_start(
    body: ReportingPreparationBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Явный старт подготовки отчётности → событие ReportPreparationStarted."""
    oid = _oid(current_user)
    await emit_report_preparation_started(db, oid, period=body.period, actor="user")
    return {"status": "ok", "period": body.period}


@router.post("/calm/validate", response_model=ReportingCalmOverview)
async def reporting_calm_validate(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Пересчитать готовность и записать ReportValidated (dual-write к журналу событий)."""
    oid = _oid(current_user)
    overview = await build_reporting_calm_overview(db, oid)
    await emit_report_validated(
        db,
        oid,
        readiness_score=overview.readiness.score,
        confidence=overview.readiness.confidence,
        issue_count=len(overview.consistency_issues),
        actor="system",
    )
    return overview
