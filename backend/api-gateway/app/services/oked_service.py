"""Поиск и загрузка справочника ОКЭД."""

from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.oked_reference import OkedReference

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "oked_seed_popular.json"


async def seed_popular_oked_if_empty(db: AsyncSession) -> int:
    """Вставляет популярные коды ОКЭД, если таблица пуста. Возвращает число вставленных."""
    existing = await db.execute(select(OkedReference.code).limit(1))
    if existing.scalar_one_or_none() is not None:
        return 0
    if not _DATA_PATH.is_file():
        return 0
    rows = json.loads(_DATA_PATH.read_text(encoding="utf-8"))
    inserted = 0
    for row in rows:
        db.add(
            OkedReference(
                code=str(row["code"]),
                name_ru=str(row["name_ru"]),
                parent_code=row.get("parent_code"),
                level=int(row.get("level") or 0),
                search_aliases=row.get("search_aliases"),
                is_active=True,
            )
        )
        inserted += 1
    await db.flush()
    return inserted


async def search_oked(db: AsyncSession, query: str, *, limit: int = 20) -> list[OkedReference]:
    q = (query or "").strip()
    stmt = select(OkedReference).where(OkedReference.is_active.is_(True))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                OkedReference.code.ilike(like),
                OkedReference.name_ru.ilike(like),
                OkedReference.search_aliases.ilike(like),
            )
        )
    stmt = stmt.order_by(OkedReference.level.desc(), OkedReference.code).limit(min(limit, 50))
    result = await db.execute(stmt)
    return list(result.scalars().all())
