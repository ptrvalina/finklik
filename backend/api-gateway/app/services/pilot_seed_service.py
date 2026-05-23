"""Демо-данные для пилотных отраслей."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction
from app.services.chart_account_service import seed_official_subaccounts_for_org

TEMPLATES = {
    "retail": {"oked": "47.11", "tx": [("income", "5000", "Розничная выручка"), ("expense", "1200", "Закуп товара")]},
    "it": {"oked": "62.01", "tx": [("income", "12000", "Разработка ПО"), ("expense", "800", "Облако")]},
    "services": {"oked": "69.20", "tx": [("income", "3000", "Консалтинг"), ("expense", "400", "Офис")]},
    "horeca": {"oked": "56.10", "tx": [("income", "8000", "Выручка зала"), ("expense", "2500", "Продукты")]},
    "logistics": {"oked": "49.41", "tx": [("income", "15000", "Перевозки"), ("expense", "6000", "ГСМ")]},
}


async def seed_pilot_industry(
    db: AsyncSession, organization_id: str, template: str, *, actor: str
) -> dict:
    _ = actor
    spec = TEMPLATES.get(template)
    if not spec:
        raise ValueError("unknown template")
    sub_count = await seed_official_subaccounts_for_org(db, organization_id)
    today = date.today()
    created = 0
    for typ, amt, desc in spec["tx"]:
        db.add(
            Transaction(
                organization_id=organization_id,
                type=typ,
                amount=Decimal(amt),
                vat_amount=Decimal("0"),
                category="other",
                description=desc,
                transaction_date=today - timedelta(days=created + 1),
                source="pilot_seed",
            )
        )
        created += 1
    await db.flush()
    return {
        "template": template,
        "oked_hint": spec["oked"],
        "transactions_created": created,
        "official_subaccounts_seeded": sub_count,
    }
