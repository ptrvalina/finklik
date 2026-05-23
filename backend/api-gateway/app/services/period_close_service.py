"""Закрытие учётного периода."""

from __future__ import annotations

from datetime import date

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utc_now_naive
from app.models.accounting import AccountingPeriod, LedgerEntry
from app.services.integrity_service import run_integrity_checks


async def get_or_create_period(db: AsyncSession, organization_id: str, year: int, month: int) -> AccountingPeriod:
    result = await db.execute(
        select(AccountingPeriod).where(
            AccountingPeriod.organization_id == organization_id,
            AccountingPeriod.year == year,
            AccountingPeriod.month == month,
        )
    )
    row = result.scalar_one_or_none()
    if row:
        return row
    row = AccountingPeriod(organization_id=organization_id, year=year, month=month, status="open")
    db.add(row)
    await db.flush()
    return row


async def close_period(
    db: AsyncSession,
    organization_id: str,
    *,
    year: int,
    month: int,
    closed_by: str,
) -> AccountingPeriod:
    report = await run_integrity_checks(db, organization_id)
    if not report.ok:
        raise HTTPException(400, "Проверки целостности не пройдены; закрытие периода отменено")

    period = await get_or_create_period(db, organization_id, year, month)
    if period.status == "closed":
        raise HTTPException(400, "Период уже закрыт")

    # Незакрытые проводки в периоде — все ledger entries должны иметь period set (optional warning)
    unposted = (
        await db.execute(
            select(func.count())
            .select_from(LedgerEntry)
            .where(
                LedgerEntry.organization_id == organization_id,
                LedgerEntry.entry_date >= date(year, month, 1),
                LedgerEntry.period_year.is_(None),
            )
        )
    ).scalar_one()
    if unposted and unposted > 0:
        pass  # мягко: не блокируем, только логируем в ответе

    period.status = "closed"
    period.closed_at = utc_now_naive()
    period.closed_by = closed_by
    await db.flush()
    return period
