"""Лёгкая генерация AIInsight после AISuggestion (без мутации данных)."""

from __future__ import annotations

import json

from app.events.constants import EV_AI_INSIGHT, EV_AI_SUGGESTION


class AiInsightStubHandler:
    interested_types = frozenset({EV_AI_SUGGESTION})

    async def handle(self, db, event, store, depth: int) -> None:
        try:
            payload = json.loads(event.payload_json or "{}")
        except json.JSONDecodeError:
            return
        suggested = (payload.get("payload") or {}).get("suggested_category") or "other"
        await store.append(
            db,
            organization_id=event.organization_id,
            event_type=EV_AI_INSIGHT,
            actor="ai",
            target_id=event.target_id,
            target_kind="transaction",
            payload={
                "kind": "AIInsight",
                "confidence": 0.5,
                "reasoning": f"Паттерн категории «{suggested}» можно закрепить правилом категоризации.",
                "payload": {"hint": "rule_suggestion", "category": suggested},
            },
            _depth=depth + 1,
        )
