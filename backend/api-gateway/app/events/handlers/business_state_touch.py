"""Маркер «проекция устарела» — параллельный слой, UI по-прежнему читает CRUD."""

from __future__ import annotations

from app.events.constants import (
    EV_BUSINESS_STATE_STALE,
    EV_TRANSACTION_CREATED,
    EV_TRANSACTION_DELETED,
    EV_TRANSACTION_UPDATED,
)
from app.models.domain_event import DomainEvent


class BusinessStateStaleHandler:
    interested_types = frozenset(
        {
            EV_TRANSACTION_CREATED,
            EV_TRANSACTION_UPDATED,
            EV_TRANSACTION_DELETED,
        }
    )

    async def handle(self, db, event: DomainEvent, store, depth: int) -> None:
        await store.append(
            db,
            organization_id=event.organization_id,
            event_type=EV_BUSINESS_STATE_STALE,
            actor="system",
            target_id=event.organization_id,
            target_kind="organization",
            payload={"reason": event.event_type},
            occurred_at_ms=event.occurred_at_ms + 1,
            _depth=depth + 1,
        )
