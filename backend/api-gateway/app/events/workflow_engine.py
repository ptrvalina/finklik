"""WorkflowEngine: обработчики реагируют на события, не переписывая CRUD."""

from __future__ import annotations

import structlog
from typing import TYPE_CHECKING, Any, Protocol

from app.models.domain_event import DomainEvent

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.events.store import EventStore

log = structlog.get_logger(__name__)

_MAX_DEPTH = 8


class DomainEventHandler(Protocol):
    interested_types: frozenset[str]

    async def handle(
        self,
        db: "AsyncSession",
        event: DomainEvent,
        store: "EventStore",
        depth: int,
    ) -> None: ...


class WorkflowEngine:
    def __init__(self, handlers: list[DomainEventHandler] | None = None) -> None:
        self.handlers: list[DomainEventHandler] = list(handlers or [])

    def register(self, handler: DomainEventHandler) -> None:
        self.handlers.append(handler)

    async def process(self, db: AsyncSession, event: DomainEvent, *, depth: int = 0) -> None:
        if depth > _MAX_DEPTH:
            log.warning("workflow_max_depth", event_type=event.event_type, depth=depth)
            return
        from app.events.bootstrap import get_event_store

        store = get_event_store()
        for h in self.handlers:
            if event.event_type in h.interested_types:
                try:
                    await h.handle(db, event, store, depth)
                except Exception:
                    log.exception("handler_failed", handler=type(h).__name__, event_type=event.event_type)
