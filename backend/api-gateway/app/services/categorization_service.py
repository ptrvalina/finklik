from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.categorization_rule import CategorizationRule
from app.models.transaction import Transaction


DEFAULT_KEYWORD_CATEGORIES: dict[str, str] = {
    "аренд": "rent",
    "офис": "office",
    "канцел": "office",
    "зарплат": "salary",
    "фсзн": "taxes",
    "налог": "taxes",
    "ндс": "taxes",
    "комисс": "services",
    "доставк": "transport",
    "топлив": "transport",
    "реклам": "marketing",
    "smm": "marketing",
    "материал": "materials",
    "сырье": "materials",
    "подписк": "services",
}


def _rule_matches(rule: CategorizationRule, tx: Transaction) -> bool:
    if rule.transaction_type and rule.transaction_type != tx.type:
        return False
    if rule.counterparty_id and rule.counterparty_id != tx.counterparty_id:
        return False
    if rule.description_pattern:
        haystack = (tx.description or "").lower()
        if rule.description_pattern.lower() not in haystack:
            return False
    if rule.min_amount is not None and Decimal(str(tx.amount)) < Decimal(str(rule.min_amount)):
        return False
    if rule.max_amount is not None and Decimal(str(tx.amount)) > Decimal(str(rule.max_amount)):
        return False
    if rule.vat_required is not None:
        has_vat = Decimal(str(tx.vat_amount or 0)) > 0
        if has_vat != rule.vat_required:
            return False
    return True


def _infer_default_category(tx: Transaction) -> str | None:
    if tx.type != "expense":
        return None
    source = (tx.description or "").lower()
    for key, category in DEFAULT_KEYWORD_CATEGORIES.items():
        if key in source:
            return category
    return None


async def auto_categorize_transaction(db: AsyncSession, tx: Transaction) -> bool:
    if tx.type != "expense":
        return False
    if tx.category:
        return False

    result = await db.execute(
        select(CategorizationRule)
        .where(
            CategorizationRule.organization_id == tx.organization_id,
            CategorizationRule.is_active.is_(True),
        )
        .order_by(CategorizationRule.priority.asc(), CategorizationRule.created_at.asc())
    )
    rules = result.scalars().all()
    for rule in rules:
        if _rule_matches(rule, tx):
            tx.category = rule.category
            tx.ai_category_confidence = Decimal("0.99")
            return True

    fallback = _infer_default_category(tx)
    if fallback:
        tx.category = fallback
        tx.ai_category_confidence = Decimal("0.75")
        return True
    return False
