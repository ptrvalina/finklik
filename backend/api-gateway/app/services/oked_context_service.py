"""Контекст ОКЭД → подсказки счетов, OCR, work packs."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Organization

# Упрощённые пресеты по префиксу ОКЭД (до полного классификатора).
OKED_ACCOUNT_HINTS: dict[str, list[str]] = {
    "47": ["41", "44", "60", "62"],
    "62": ["90", "62", "71", "76"],
    "56": ["50", "10", "60", "44"],
    "49": ["20", "10", "60", "71"],
    "41": ["20", "23", "25", "10"],
    "69": ["90", "70", "68", "76"],
}


def oked_prefix(code: str | None) -> str:
    if not code:
        return ""
    return code.strip().split(".")[0]


async def get_organization_oked_hints(db: AsyncSession, organization_id: str) -> dict:
    org = (
        await db.execute(select(Organization).where(Organization.id == organization_id))
    ).scalar_one_or_none()
    if not org or not org.oked_primary:
        return {"primary_accounts": ["51", "60", "62", "90"], "ocr_focus": "general"}
    prefix = oked_prefix(org.oked_primary)
    accounts = OKED_ACCOUNT_HINTS.get(prefix, ["51", "60", "62", "68", "90"])
    ocr_focus = {
        "47": "retail",
        "62": "services",
        "56": "horeca",
        "49": "transport",
    }.get(prefix, "general")
    return {
        "oked_primary": org.oked_primary,
        "primary_accounts": accounts,
        "ocr_focus": ocr_focus,
        "tax_regime": org.tax_regime,
        "legal_form": org.legal_form,
    }
