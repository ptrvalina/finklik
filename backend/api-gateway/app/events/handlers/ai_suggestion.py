"""Реакция на TransactionCreated: только событие AISuggestion (CRUD уже сохранён)."""

from __future__ import annotations

import json
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.constants import EV_AI_SUGGESTION, EV_TRANSACTION_CREATED
from app.models.domain_event import DomainEvent
from app.models.transaction import Transaction
from app.services.structured_ai_analysis import analyze_transaction_ai


class AiSuggestionHandler:
    interested_types = frozenset({EV_TRANSACTION_CREATED})

    async def handle(self, db: AsyncSession, event: DomainEvent, store, depth: int) -> None:
        try:
            payload = json.loads(event.payload_json or "{}")
        except json.JSONDecodeError:
            payload = {}
        if payload.get("transaction_type") != "expense":
            return
        r = await db.execute(select(Transaction).where(Transaction.id == event.target_id))
        tx = r.scalar_one_or_none()
        if not tx or tx.type != "expense":
            return
        analysis = await analyze_transaction_ai(db, tx)
        await store.append(
            db,
            organization_id=event.organization_id,
            event_type=EV_AI_SUGGESTION,
            actor="ai",
            target_id=tx.id,
            target_kind="transaction",
            payload={
                "kind": "AISuggestion",
                "confidence": float(analysis.confidence),
                "reasoning": analysis.reasoning,
                "risk_level": analysis.risk_level,
                "payload": {
                    "suggested_category": analysis.suggested_category,
                    "alternatives": analysis.alternative_suggestions,
                    "business_context": analysis.business_context,
                },
            },
            occurred_at_ms=event.occurred_at_ms + 1,
            _depth=depth + 1,
        )
