"""Database-backed audit logging helpers."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def safe_log_audit(
    db: AsyncSession,
    user_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    metadata: dict | None = None,
) -> None:
    """Persist audit row; failures are logged and do not break the main transaction."""
    try:
        await log_audit(db, user_id, action, entity_type, entity_id, metadata)
    except Exception as exc:
        structlog.get_logger().warning(
            "audit_log_insert_failed",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            error=str(exc),
        )


async def log_audit(
    db: AsyncSession,
    user_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    metadata: dict | None = None,
) -> None:
    """Write a structured audit record for HR/financial actions."""
    payload = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "created_at": datetime.now(timezone.utc),
        "metadata": metadata or {},
    }
    # New table per migration.
    await db.execute(
        text(
            """
            INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, created_at, metadata)
            VALUES (:id, :user_id, :action, :entity_type, :entity_id, :created_at, :metadata)
            """
        ),
        payload,
    )
