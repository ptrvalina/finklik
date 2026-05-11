"""Лёгкая операционная память из уже существующих данных — без отдельного «большого мозга» (Flow 9)."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction


async def load_operational_memory_hints(db: AsyncSession, organization_id: str, *, limit: int = 5) -> list[str]:
    hints: list[str] = []
    since = date.today() - timedelta(days=120)

    cat_q = await db.execute(
        select(Transaction.category, func.count(Transaction.id))
        .where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type == "expense",
                Transaction.transaction_date >= since,
                Transaction.category.isnot(None),
                Transaction.category != "",
            )
        )
        .group_by(Transaction.category)
        .order_by(func.count(Transaction.id).desc())
        .limit(1)
    )
    row = cat_q.first()
    if row and row[0]:
        hints.append(
            f"Чаще всего расходы попадают в категорию «{row[0]}» — можно быстрее проверять однотипные операции."
        )

    high_conf_q = await db.execute(
        select(func.count(Transaction.id)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.ai_category_confidence.isnot(None),
                Transaction.ai_category_confidence >= Decimal("0.92"),
                Transaction.transaction_date >= since,
            )
        )
    )
    hc = int(high_conf_q.scalar() or 0)
    if hc >= 5:
        hints.append(
            "ИИ уже многократно уверенно категоризировал операции — допускается аккуратное автозаполнение категорий в безопасном режиме."
        )

    draft_q = await db.execute(
        select(func.count(Transaction.id)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.status == "draft",
                Transaction.transaction_date >= since,
            )
        )
    )
    drafts = int(draft_q.scalar() or 0)
    if drafts >= 3:
        hints.append(
            f"Повторяющийся паттерн: {drafts} черновиков за период — имеет смысл закрывать их регулярным проходом."
        )

    return hints[:limit]
