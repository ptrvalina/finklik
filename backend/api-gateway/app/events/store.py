"""EventStore: персистентный append + запросы (отдельная таблица domain_events)."""

from __future__ import annotations

import json
import time
import uuid
from typing import Any

import structlog
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain_event import DomainEvent

log = structlog.get_logger(__name__)


class EventStore:
    def __init__(self, workflow_engine: Any | None = None) -> None:
        self._workflow = workflow_engine

    def bind_workflow(self, workflow_engine: Any) -> None:
        self._workflow = workflow_engine

    async def append(
        self,
        db: AsyncSession,
        *,
        organization_id: str,
        event_type: str,
        actor: str,
        target_id: str,
        payload: dict[str, Any] | None = None,
        target_kind: str | None = None,
        occurred_at_ms: int | None = None,
        skip_workflow: bool = False,
        idempotency_key: str | None = None,
        _depth: int = 0,
    ) -> DomainEvent:
        if idempotency_key:
            dup = await db.execute(
                select(DomainEvent).where(
                    DomainEvent.organization_id == organization_id,
                    DomainEvent.idempotency_key == idempotency_key,
                )
            )
            existing = dup.scalar_one_or_none()
            if existing is not None:
                log.info(
                    "domain_event_idempotent_skip",
                    organization_id=organization_id,
                    event_type=event_type,
                    idempotency_key=idempotency_key,
                )
                return existing

        row = DomainEvent(
            id=str(uuid.uuid4()),
            organization_id=organization_id,
            event_type=event_type,
            actor=actor,
            target_id=target_id,
            target_kind=target_kind,
            payload_json=json.dumps(payload or {}, ensure_ascii=False),
            occurred_at_ms=occurred_at_ms if occurred_at_ms is not None else int(time.time() * 1000),
            idempotency_key=idempotency_key,
        )
        db.add(row)
        await db.flush()
        if not skip_workflow and self._workflow is not None:
            try:
                await self._workflow.process(db, row, depth=_depth)
            except Exception:
                log.exception("workflow_process_failed", event_type=event_type, target_id=target_id)
        return row

    async def query_by_entity(
        self,
        db: AsyncSession,
        organization_id: str,
        target_id: str,
        limit: int = 200,
    ) -> list[DomainEvent]:
        r = await db.execute(
            select(DomainEvent)
            .where(
                and_(
                    DomainEvent.organization_id == organization_id,
                    DomainEvent.target_id == target_id,
                )
            )
            .order_by(desc(DomainEvent.occurred_at_ms))
            .limit(limit)
        )
        return list(r.scalars().all())

    async def query_by_type(
        self,
        db: AsyncSession,
        organization_id: str,
        event_type: str,
        limit: int = 200,
    ) -> list[DomainEvent]:
        r = await db.execute(
            select(DomainEvent)
            .where(
                and_(
                    DomainEvent.organization_id == organization_id,
                    DomainEvent.event_type == event_type,
                )
            )
            .order_by(desc(DomainEvent.occurred_at_ms))
            .limit(limit)
        )
        return list(r.scalars().all())

    async def query_recent(
        self,
        db: AsyncSession,
        organization_id: str,
        limit: int = 100,
    ) -> list[DomainEvent]:
        r = await db.execute(
            select(DomainEvent)
            .where(DomainEvent.organization_id == organization_id)
            .order_by(desc(DomainEvent.occurred_at_ms))
            .limit(limit)
        )
        return list(r.scalars().all())
