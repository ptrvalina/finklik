"""Бухгалтерские отчёты: ОСВ, обороты, карточка счёта."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import LedgerEntry


def _root(code: str) -> str:
    return (code or "").split(".")[0]


async def trial_balance(
    db: AsyncSession,
    organization_id: str,
    *,
    date_from: date,
    date_to: date,
) -> dict:
    stmt = select(LedgerEntry).where(
        LedgerEntry.organization_id == organization_id,
        LedgerEntry.entry_date >= date_from,
        LedgerEntry.entry_date <= date_to,
    )
    rows = (await db.execute(stmt)).scalars().all()
    accounts: dict[str, dict] = defaultdict(lambda: {"debit_turnover": Decimal("0"), "credit_turnover": Decimal("0")})

    for e in rows:
        amt = Decimal(str(e.amount))
        accounts[_root(e.debit_account)]["debit_turnover"] += amt
        accounts[_root(e.credit_account)]["credit_turnover"] += amt

    lines = []
    for code in sorted(accounts.keys()):
        a = accounts[code]
        lines.append(
            {
                "account": code,
                "debit_turnover": str(a["debit_turnover"]),
                "credit_turnover": str(a["credit_turnover"]),
                "balance_debit": str(max(a["debit_turnover"] - a["credit_turnover"], Decimal("0"))),
                "balance_credit": str(max(a["credit_turnover"] - a["debit_turnover"], Decimal("0"))),
            }
        )
    return {
        "report": "trial_balance",
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "lines": lines,
    }


async def turnover_balance_sheet(
    db: AsyncSession,
    organization_id: str,
    *,
    date_from: date,
    date_to: date,
    account: str | None = None,
) -> dict:
    """Оборотно-сальдовая ведомость (упрощённая)."""
    tb = await trial_balance(db, organization_id, date_from=date_from, date_to=date_to)
    if account:
        tb["lines"] = [ln for ln in tb["lines"] if ln["account"] == _root(account)]
    tb["report"] = "turnover_balance_sheet"
    return tb


async def account_card(
    db: AsyncSession,
    organization_id: str,
    *,
    account: str,
    date_from: date,
    date_to: date,
) -> dict:
    root = _root(account)
    stmt = select(LedgerEntry).where(
        LedgerEntry.organization_id == organization_id,
        LedgerEntry.entry_date >= date_from,
        LedgerEntry.entry_date <= date_to,
        or_(
            LedgerEntry.debit_account.startswith(root),
            LedgerEntry.credit_account.startswith(root),
        ),
    ).order_by(LedgerEntry.entry_date, LedgerEntry.created_at)
    rows = (await db.execute(stmt)).scalars().all()
    entries = []
    for e in rows:
        entries.append(
            {
                "id": e.id,
                "date": e.entry_date.isoformat(),
                "debit": e.debit_account,
                "credit": e.credit_account,
                "amount": str(e.amount),
                "description": e.description,
                "is_reversal": e.is_reversal,
            }
        )
    return {
        "report": "account_card",
        "account": account,
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "entries": entries,
    }


async def journal_export(
    db: AsyncSession,
    organization_id: str,
    *,
    date_from: date,
    date_to: date,
    limit: int = 500,
) -> dict:
    stmt = (
        select(LedgerEntry)
        .where(
            LedgerEntry.organization_id == organization_id,
            LedgerEntry.entry_date >= date_from,
            LedgerEntry.entry_date <= date_to,
        )
        .order_by(LedgerEntry.entry_date.desc(), LedgerEntry.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "report": "journal",
        "entries": [
            {
                "id": r.id,
                "date": r.entry_date.isoformat(),
                "debit": r.debit_account,
                "credit": r.credit_account,
                "amount": str(r.amount),
                "vat_amount": str(r.vat_amount) if r.vat_amount is not None else None,
                "description": r.description,
            }
            for r in rows
        ],
    }
