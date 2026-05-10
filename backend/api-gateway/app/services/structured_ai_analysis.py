"""Структурированный «разумный» разбор операции без обязательного LLM (правила + эвристики)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.categorization_rule import CategorizationRule
from app.models.transaction import Transaction
from app.schemas.business_os import AIAnalysisResponse
from app.services.categorization_service import DEFAULT_KEYWORD_CATEGORIES, _infer_default_category, _rule_matches


async def analyze_transaction_ai(db: AsyncSession, tx: Transaction) -> AIAnalysisResponse:
    """Строит AIAnalysis для операции: объяснение, риск, альтернативы."""
    alternatives: list[str] = []

    if tx.type != "expense":
        return AIAnalysisResponse(
            suggested_category=None,
            confidence=Decimal("0"),
            reasoning="Классификация статей затрат применяется к расходам; для доходов используйте поток выручки.",
            risk_level="low",
            business_context="Доходная операция — учитывайте контрагента и договор.",
            alternative_suggestions=alternatives,
        )

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
            alternatives.append(rule.category)
            return AIAnalysisResponse(
                suggested_category=rule.category,
                confidence=Decimal("0.95"),
                reasoning=f"Сработало пользовательское правило категоризации (приоритет {rule.priority}).",
                risk_level="low",
                business_context="Правило отражает вашу политику учёта по контрагентам или тексту платежа.",
                alternative_suggestions=list(dict.fromkeys(alternatives))[:5],
            )

    fb = _infer_default_category(tx)
    if fb:
        risk = "medium" if fb in ("taxes", "salary") else "low"
        return AIAnalysisResponse(
            suggested_category=fb,
            confidence=Decimal("0.72"),
            reasoning="Категория выведена по ключевым словам в назначении платежа (эвристика учета ИП).",
            risk_level=risk,
            business_context="Проверьте соответствие фактическому договору и первичным документам.",
            alternative_suggestions=sorted(set(DEFAULT_KEYWORD_CATEGORIES.values()))[:5],
        )

    return AIAnalysisResponse(
        suggested_category="other",
        confidence=Decimal("0.45"),
        reasoning="Недостаточно сигналов для уверенной категории — уточните описание или создайте правило.",
        risk_level="medium",
        business_context="Без категории затруднена аналитика УСН и контроль лимитов.",
        alternative_suggestions=["services", "materials", "office", "transport", "marketing"],
    )
