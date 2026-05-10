"""Единый снимок BusinessState по журналу операций и обязательствам."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utc_now_naive
from app.models.business_os import FinancialObligation
from app.models.transaction import Transaction
from app.schemas.business_os import BusinessStateResponse, CategoryMetric


def _month_bounds(d: date) -> tuple[date, date]:
    start = date(d.year, d.month, 1)
    if d.month == 12:
        end = date(d.year, 12, 31)
    else:
        end = date(d.year, d.month + 1, 1)
        from datetime import timedelta

        end = end - timedelta(days=1)
    return start, end


async def compute_business_state(db: AsyncSession, organization_id: str) -> BusinessStateResponse:
    today = utc_now_naive().date()
    month_start, month_end = _month_bounds(today)

    inc_m = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type == "income",
                Transaction.transaction_date >= month_start,
                Transaction.transaction_date <= month_end,
            )
        )
    )
    monthly_revenue = Decimal(str(inc_m.scalar() or 0))

    exp_m = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type == "expense",
                Transaction.transaction_date >= month_start,
                Transaction.transaction_date <= month_end,
            )
        )
    )
    monthly_expenses = Decimal(str(exp_m.scalar() or 0))

    inc_all = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(Transaction.organization_id == organization_id, Transaction.type == "income")
        )
    )
    exp_all = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type.in_(["expense", "writeoff"]),
            )
        )
    )
    total_revenue = Decimal(str(inc_all.scalar() or 0))
    total_expenses = Decimal(str(exp_all.scalar() or 0))
    profit = total_revenue - total_expenses
    cashflow_net = profit

    cat_rows = await db.execute(
        select(Transaction.category, func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type == "expense",
                Transaction.transaction_date >= month_start,
                Transaction.transaction_date <= month_end,
            )
        )
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(5)
    )
    top: list[CategoryMetric] = []
    for cat, amt in cat_rows.all():
        top.append(CategoryMetric(category=cat or "other", amount=Decimal(str(amt))))

    pend_q = await db.execute(
        select(func.count(FinancialObligation.id)).where(
            and_(
                FinancialObligation.organization_id == organization_id,
                FinancialObligation.status == "pending",
            )
        )
    )
    pending_obligations_count = int(pend_q.scalar() or 0)

    overdue_q = await db.execute(
        select(func.count(FinancialObligation.id)).where(
            and_(
                FinancialObligation.organization_id == organization_id,
                FinancialObligation.status != "paid",
                FinancialObligation.due_date < today,
            )
        )
    )
    overdue_obligations_count = int(overdue_q.scalar() or 0)

    financial_health_status = "ok"
    if overdue_obligations_count > 0 or (monthly_revenue > 0 and monthly_expenses > monthly_revenue * Decimal("0.98") and profit < 0):
        financial_health_status = "risk"
    elif pending_obligations_count >= 3 or (monthly_revenue > 0 and monthly_expenses / monthly_revenue > Decimal("0.85")):
        financial_health_status = "warning"

    return BusinessStateResponse(
        total_revenue=total_revenue,
        total_expenses=total_expenses,
        profit=profit,
        cashflow_net=cashflow_net,
        monthly_revenue=monthly_revenue,
        monthly_expenses=monthly_expenses,
        top_expense_categories=top,
        financial_health_status=financial_health_status,
        pending_obligations_count=pending_obligations_count,
        overdue_obligations_count=overdue_obligations_count,
        updated_at=utc_now_naive(),
    )
