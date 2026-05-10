"""Эвристика сверки документ ↔ транзакция (только событие-подсказка, строки сверки не создаём)."""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.constants import EV_DOCUMENT_OCR_PROCESSED, EV_RECONCILIATION_SUGGESTED
from app.models.domain_event import DomainEvent
from app.models.transaction import Transaction


class ReconciliationSuggestHandler:
    interested_types = frozenset({EV_DOCUMENT_OCR_PROCESSED})

    async def handle(self, db: AsyncSession, event: DomainEvent, store, depth: int) -> None:
        try:
            outer = json.loads(event.payload_json or "{}")
        except json.JSONDecodeError:
            return
        parsed = outer.get("parsed") or {}
        amount_raw = parsed.get("amount")
        date_raw = parsed.get("transaction_date")
        if amount_raw is None or date_raw is None:
            return
        try:
            amt = Decimal(str(amount_raw))
            tx_date = date.fromisoformat(str(date_raw))
        except Exception:
            return
        if amt <= 0:
            return
        r = await db.execute(
            select(Transaction)
            .where(
                Transaction.organization_id == event.organization_id,
                Transaction.transaction_date == tx_date,
                Transaction.amount == amt,
            )
            .order_by(desc(Transaction.created_at))
            .limit(3)
        )
        candidates = [t.id for t in r.scalars().all()]
        if not candidates:
            return
        await store.append(
            db,
            organization_id=event.organization_id,
            event_type=EV_RECONCILIATION_SUGGESTED,
            actor="system",
            target_id=event.target_id,
            target_kind="document",
            payload={
                "document_id": event.target_id,
                "candidate_transaction_ids": candidates,
                "confidence": 0.75,
            },
            _depth=depth + 1,
        )
