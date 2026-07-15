"""Tests for idempotent schema repair (scanner columns)."""
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app import models as _models  # noqa: F401
from app.core.database import Base
from app.services.db_schema_repair import repair_scanned_documents_schema


@pytest.mark.asyncio
async def test_repair_adds_scanner_columns_to_legacy_table():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Эмуляция старой таблицы без OCR-колонок.
        await conn.execute(
            __import__("sqlalchemy").text("DROP TABLE IF EXISTS scanned_documents")
        )
        await conn.execute(
            __import__("sqlalchemy").text(
                """
                CREATE TABLE scanned_documents (
                    id VARCHAR(36) PRIMARY KEY,
                    organization_id VARCHAR(36) NOT NULL,
                    user_id VARCHAR(36) NOT NULL,
                    filename VARCHAR(255) NOT NULL,
                    doc_type VARCHAR(30),
                    status VARCHAR(20),
                    ocr_text TEXT,
                    parsed_data TEXT,
                    confidence INTEGER,
                    transaction_id VARCHAR(36),
                    created_at DATETIME
                )
                """
            )
        )

    added = await repair_scanned_documents_schema(engine)
    assert "requires_review" in added
    assert "field_confidence_json" in added
    assert "lifecycle_status" in added

    async with engine.connect() as conn:
        cols = await conn.run_sync(
            lambda sync_conn: {c["name"] for c in __import__("sqlalchemy").inspect(sync_conn).get_columns("scanned_documents")}
        )
    assert "requires_review" in cols
    assert "field_confidence_json" in cols
    await engine.dispose()


@pytest.mark.asyncio
async def test_repair_is_idempotent():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    first = await repair_scanned_documents_schema(engine)
    second = await repair_scanned_documents_schema(engine)
    assert first == []
    assert second == []
    await engine.dispose()
