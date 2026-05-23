"""Бухгалтерские отчёты."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, workspace_organization_id
from app.models.user import User
from app.services.accounting_reports_service import (
    account_card,
    journal_export,
    trial_balance,
    turnover_balance_sheet,
)

router = APIRouter(prefix="/accounting/reports", tags=["accounting-reports"])


@router.get("/trial-balance")
async def report_trial_balance(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    return await trial_balance(db, oid, date_from=date_from, date_to=date_to)


@router.get("/turnover-balance")
async def report_osv(
    date_from: date = Query(...),
    date_to: date = Query(...),
    account: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    return await turnover_balance_sheet(db, oid, date_from=date_from, date_to=date_to, account=account)


@router.get("/account-card")
async def report_account_card(
    account: str = Query(..., min_length=1),
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    return await account_card(db, oid, account=account, date_from=date_from, date_to=date_to)


@router.get("/journal")
async def report_journal(
    date_from: date = Query(...),
    date_to: date = Query(...),
    limit: int = Query(500, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    oid = workspace_organization_id(current_user)
    org = oid
    return await journal_export(db, org, date_from=date_from, date_to=date_to, limit=limit)
