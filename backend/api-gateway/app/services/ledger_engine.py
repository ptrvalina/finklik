"""Движок проводок: валидация, закрытые периоды, сторно."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import AccountingPeriod, ChartAccount, LedgerEntry


@dataclass
class PostingPreview:
    valid: bool
    errors: list[str]
    debit_account: str
    credit_account: str
    amount: Decimal
    vat_amount: Decimal | None


def _account_code_root(code: str) -> str:
    return (code or "").split(".")[0].strip()


async def _period_is_closed(db: AsyncSession, organization_id: str, entry_date: date) -> bool:
    result = await db.execute(
        select(AccountingPeriod).where(
            AccountingPeriod.organization_id == organization_id,
            AccountingPeriod.year == entry_date.year,
            AccountingPeriod.month == entry_date.month,
            AccountingPeriod.status == "closed",
        )
    )
    return result.scalar_one_or_none() is not None


async def validate_posting(
    db: AsyncSession,
    organization_id: str,
    *,
    entry_date: date,
    debit_account: str,
    credit_account: str,
    amount: Decimal,
    vat_amount: Decimal | None = None,
) -> PostingPreview:
    errors: list[str] = []
    if amount <= 0:
        errors.append("Сумма проводки должна быть больше нуля")
        return PostingPreview(
            valid=False,
            errors=errors,
            debit_account=debit_account,
            credit_account=credit_account,
            amount=amount,
            vat_amount=vat_amount,
        )
    if debit_account.strip() == credit_account.strip():
        errors.append("Дебет и кредит не могут совпадать")
    if await _period_is_closed(db, organization_id, entry_date):
        errors.append(f"Период {entry_date.year}-{entry_date.month:02d} закрыт для проводок")

    codes = {_account_code_root(debit_account), _account_code_root(credit_account)}
    rows = await db.execute(select(ChartAccount.code).where(ChartAccount.code.in_(codes)))
    found = {r[0] for r in rows.all()}
    for c in codes:
        if c and c not in found:
            errors.append(f"Счёт {c} отсутствует в плане счетов")

    if vat_amount is not None and vat_amount < 0:
        errors.append("НДС не может быть отрицательным")

    return PostingPreview(
        valid=not errors,
        errors=errors,
        debit_account=debit_account,
        credit_account=credit_account,
        amount=amount,
        vat_amount=vat_amount,
    )


async def assert_posting_allowed(
    db: AsyncSession,
    organization_id: str,
    *,
    entry_date: date,
    debit_account: str,
    credit_account: str,
    amount: Decimal,
    vat_amount: Decimal | None = None,
) -> PostingPreview:
    preview = await validate_posting(
        db,
        organization_id,
        entry_date=entry_date,
        debit_account=debit_account,
        credit_account=credit_account,
        amount=amount,
        vat_amount=vat_amount,
    )
    if not preview.valid:
        raise HTTPException(400, "; ".join(preview.errors))
    return preview


async def create_reversal_entry(
    db: AsyncSession,
    organization_id: str,
    original: LedgerEntry,
    *,
    entry_date: date | None = None,
    actor: str = "user",
) -> LedgerEntry:
    from app.services.chart_account_service import post_ledger_entry

    if original.is_reversal:
        raise HTTPException(400, "Нельзя сторнировать сторнирующую проводку")
    rev_date = entry_date or original.entry_date
    await assert_posting_allowed(
        db,
        organization_id,
        entry_date=rev_date,
        debit_account=original.credit_account,
        credit_account=original.debit_account,
        amount=original.amount,
        vat_amount=original.vat_amount,
    )
    entry = await post_ledger_entry(
        db,
        organization_id,
        entry_date=rev_date,
        debit_account=original.credit_account,
        credit_account=original.debit_account,
        amount=original.amount,
        description=f"Сторно: {original.description or original.id}",
        source_type="reversal",
        source_id=original.id,
        actor=actor,
    )
    entry.is_reversal = True
    entry.reversal_of_id = original.id
    entry.period_year = rev_date.year
    entry.period_month = rev_date.month
    await db.flush()
    return entry
