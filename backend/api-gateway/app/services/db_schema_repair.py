"""Идемпотентное догоняние схемы БД, когда create_all() не добавляет новые колонки."""

from __future__ import annotations

import structlog
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncEngine

log = structlog.get_logger()

# Колонки scanned_documents, без которых OCR/сканер падает с 500.
_SCANNED_DOCUMENTS_COLUMNS: tuple[tuple[str, str], ...] = (
    ("lifecycle_status", "VARCHAR(20) NOT NULL DEFAULT 'uploaded'"),
    ("duplicate_of_id", "VARCHAR(36)"),
    ("requires_review", "BOOLEAN NOT NULL DEFAULT 0"),
    ("field_confidence_json", "TEXT"),
)


def _add_missing_columns(sync_conn, table: str, columns: tuple[tuple[str, str], ...]) -> list[str]:
    insp = inspect(sync_conn)
    if table not in insp.get_table_names():
        return []
    existing = {c["name"] for c in insp.get_columns(table)}
    added: list[str] = []
    for name, ddl in columns:
        if name in existing:
            continue
        sync_conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
        added.append(name)
    return added


async def repair_scanned_documents_schema(engine: AsyncEngine) -> list[str]:
    """Добавляет недостающие колонки scanned_documents (SQLite/PostgreSQL)."""
    async with engine.begin() as conn:
        added = await conn.run_sync(
            lambda sync_conn: _add_missing_columns(sync_conn, "scanned_documents", _SCANNED_DOCUMENTS_COLUMNS)
        )
    if added:
        log.info("db_schema_repair_scanned_documents", added=added)
    return added


async def repair_known_schema_gaps(engine: AsyncEngine) -> dict[str, list[str]]:
    scanned = await repair_scanned_documents_schema(engine)
    return {"scanned_documents": scanned}
