from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract, case
from decimal import Decimal
from datetime import date, datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User
from app.models.transaction import Transaction
from app.schemas.transaction import CATEGORY_LABELS

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)


@router.get("/monthly-summary")
async def monthly_summary(
    year: int = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Income/expense aggregated by month for a given year."""
    if year is None:
        year = datetime.now(timezone.utc).year
    org_id = current_user.organization_id

    result = await db.execute(
        select(
            extract("month", Transaction.transaction_date).label("month"),
            func.coalesce(
                func.sum(case((Transaction.type == "income", Transaction.amount), else_=0)),
                0,
            ).label("income"),
            func.coalesce(
                func.sum(case((Transaction.type == "expense", Transaction.amount), else_=0)),
                0,
            ).label("expense"),
            func.count(Transaction.id).label("count"),
        )
        .where(
            and_(
                Transaction.organization_id == org_id,
                extract("year", Transaction.transaction_date) == year,
            )
        )
        .group_by(extract("month", Transaction.transaction_date))
        .order_by(extract("month", Transaction.transaction_date))
    )
    rows = result.all()

    months = [
        "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
        "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
    ]
    data = []
    row_map = {int(r.month): r for r in rows}
    for m in range(1, 13):
        r = row_map.get(m)
        data.append({
            "month": m,
            "label": months[m - 1],
            "income": float(r.income) if r else 0,
            "expense": float(r.expense) if r else 0,
            "count": r.count if r else 0,
        })

    total_income = sum(d["income"] for d in data)
    total_expense = sum(d["expense"] for d in data)
    return {
        "year": year,
        "months": data,
        "total_income": total_income,
        "total_expense": total_expense,
        "profit": total_income - total_expense,
    }


@router.get("/expense-categories")
async def expense_categories(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Group expenses by category."""
    org_id = current_user.organization_id
    filters = [
        Transaction.organization_id == org_id,
        Transaction.type == "expense",
    ]
    if date_from:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to:
        filters.append(Transaction.transaction_date <= date_to)

    result = await db.execute(
        select(
            func.coalesce(Transaction.category, "other").label("category"),
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("count"),
        )
        .where(and_(*filters))
        .group_by(func.coalesce(Transaction.category, "other"))
        .order_by(func.sum(Transaction.amount).desc())
    )
    rows = result.all()

    grand_total = sum(float(r.total) for r in rows) or 1
    items = []
    for r in rows:
        cat = r.category
        items.append({
            "category": cat,
            "label": CATEGORY_LABELS.get(cat, cat),
            "total": float(r.total),
            "count": r.count,
            "percent": round(float(r.total) / grand_total * 100, 1),
        })

    return {"items": items, "grand_total": grand_total}


@router.get("/income-expense-trend")
async def income_expense_trend(
    months: int = Query(6, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Daily income/expense for the last N months (for sparklines)."""
    org_id = current_user.organization_id
    now = datetime.now(timezone.utc)
    start_month = now.month - months
    start_year = now.year
    while start_month <= 0:
        start_month += 12
        start_year -= 1
    start_date = date(start_year, start_month, 1)

    result = await db.execute(
        select(
            Transaction.transaction_date,
            func.sum(case((Transaction.type == "income", Transaction.amount), else_=0)).label("income"),
            func.sum(case((Transaction.type == "expense", Transaction.amount), else_=0)).label("expense"),
        )
        .where(
            and_(
                Transaction.organization_id == org_id,
                Transaction.transaction_date >= start_date,
            )
        )
        .group_by(Transaction.transaction_date)
        .order_by(Transaction.transaction_date)
    )
    rows = result.all()

    return {
        "points": [
            {
                "date": str(r.transaction_date),
                "income": float(r.income),
                "expense": float(r.expense),
            }
            for r in rows
        ]
    }
