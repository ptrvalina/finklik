"""Агрегаты по контрагентам для списка и актов."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.counterparty import Counterparty
from app.models.transaction import Transaction


def _signed_amount_expr():
    return case((Transaction.type == "income", Transaction.amount), else_=-Transaction.amount)


async def batch_counterparty_stats(
    db: AsyncSession,
    organization_id: str,
    counterparties: list[Counterparty],
) -> dict[str, dict]:
    """Значения для расширенного списка: сальдо, последняя операция, число операций за неделю."""
    ids = [c.id for c in counterparties]
    out = {
        str(c.id): {
            "balance_net": Decimal("0"),
            "last_transaction_date": None,
            "last_transaction_amount": None,
            "week_tx_count": 0,
        }
        for c in counterparties
    }
    if not ids:
        return out

    week_ago = date.today() - timedelta(days=7)

    bal_stmt = (
        select(
            Transaction.counterparty_id,
            func.coalesce(func.sum(_signed_amount_expr()), 0).label("balance"),
            func.coalesce(
                func.sum(case((Transaction.transaction_date >= week_ago, 1), else_=0)),
                0,
            ).label("week_n"),
            func.max(Transaction.transaction_date).label("last_d"),
        )
        .where(
            Transaction.organization_id == organization_id,
            Transaction.counterparty_id.in_(ids),
        )
        .group_by(Transaction.counterparty_id)
    )
    bal_rows = (await db.execute(bal_stmt)).all()
    for row in bal_rows:
        cid = str(row.counterparty_id)
        if cid not in out:
            continue
        out[cid]["balance_net"] = Decimal(str(row.balance))
        out[cid]["week_tx_count"] = int(row.week_n or 0)
        out[cid]["last_transaction_date"] = row.last_d

    rn = func.row_number().over(
        partition_by=Transaction.counterparty_id,
        order_by=Transaction.transaction_date.desc(),
    ).label("rn")
    sub = (
        select(
            Transaction.counterparty_id,
            Transaction.amount,
            Transaction.transaction_date,
            rn,
        ).where(
            Transaction.organization_id == organization_id,
            Transaction.counterparty_id.in_(ids),
        )
    ).subquery()
    last_stmt = select(sub).where(sub.c.rn == 1)
    for row in (await db.execute(last_stmt)).all():
        cid = str(row.counterparty_id)
        if cid in out:
            out[cid]["last_transaction_amount"] = row.amount
            if out[cid]["last_transaction_date"] is None:
                out[cid]["last_transaction_date"] = row.transaction_date

    return out


async def opening_balance_until(
    db: AsyncSession,
    organization_id: str,
    counterparty_id: str,
    before_date: date,
) -> Decimal:
    q = select(func.coalesce(func.sum(_signed_amount_expr()), 0)).where(
        Transaction.organization_id == organization_id,
        Transaction.counterparty_id == counterparty_id,
        Transaction.transaction_date < before_date,
    )
    r = await db.execute(q)
    return Decimal(str(r.scalar_one()))


async def transactions_for_period(
    db: AsyncSession,
    organization_id: str,
    counterparty_id: str,
    date_from: date,
    date_to: date,
) -> list[Transaction]:
    result = await db.execute(
        select(Transaction)
        .where(
            Transaction.organization_id == organization_id,
            Transaction.counterparty_id == counterparty_id,
            Transaction.transaction_date >= date_from,
            Transaction.transaction_date <= date_to,
        )
        .order_by(Transaction.transaction_date, Transaction.id)
    )
    return list(result.scalars().all())
