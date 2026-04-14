"""Нумерация первичных документов по организации (год + тип)."""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import PrimaryDocumentSequence

_PREFIX = {"invoice": "СЧ", "act": "АКТ", "waybill": "ТН"}


def format_document_number(doc_type: str, year: int, seq: int) -> str:
    prefix = _PREFIX.get(doc_type, "ДОК")
    return f"{prefix}-{year}-{seq:05d}"


async def _get_or_create_sequence_row(
    db: AsyncSession, organization_id: str, doc_type: str, year: int
) -> PrimaryDocumentSequence:
    q = await db.execute(
        select(PrimaryDocumentSequence)
        .where(
            PrimaryDocumentSequence.organization_id == organization_id,
            PrimaryDocumentSequence.doc_type == doc_type,
            PrimaryDocumentSequence.year == year,
        )
        .with_for_update()
    )
    row = q.scalar_one_or_none()
    if row:
        return row
    row = PrimaryDocumentSequence(
        organization_id=organization_id,
        doc_type=doc_type,
        year=year,
        last_number=0,
    )
    db.add(row)
    await db.flush()
    return row


async def peek_next_document_number(db: AsyncSession, organization_id: str, doc_type: str) -> str:
    """Следующий номер без резервирования (для подсказки в UI)."""
    year = datetime.utcnow().year
    q = await db.execute(
        select(PrimaryDocumentSequence).where(
            PrimaryDocumentSequence.organization_id == organization_id,
            PrimaryDocumentSequence.doc_type == doc_type,
            PrimaryDocumentSequence.year == year,
        )
    )
    row = q.scalar_one_or_none()
    nxt = (row.last_number + 1) if row else 1
    return format_document_number(doc_type, year, nxt)


async def allocate_next_document_number(db: AsyncSession, organization_id: str, doc_type: str) -> str:
    """Атомарно увеличивает счётчик и возвращает номер документа."""
    year = datetime.utcnow().year
    row = await _get_or_create_sequence_row(db, organization_id, doc_type, year)
    row.last_number += 1
    await db.flush()
    return format_document_number(doc_type, year, row.last_number)
