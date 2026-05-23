"""ОКЭД РБ — поиск и справочник для onboarding."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.oked_service import search_oked, seed_popular_oked_if_empty

router = APIRouter(prefix="/oked", tags=["oked"])


class OkedItemOut(BaseModel):
    code: str
    name_ru: str
    parent_code: str | None = None
    level: int = 0


class OkedSearchOut(BaseModel):
    items: list[OkedItemOut]
    query: str


@router.get("/search", response_model=OkedSearchOut, summary="Поиск ОКЭД по коду или названию")
async def oked_search(
    q: str = Query("", max_length=120, description="Код, название или ключевые слова (кафе, IT, магазин)"),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> OkedSearchOut:
    await seed_popular_oked_if_empty(db)
    rows = await search_oked(db, q, limit=limit)
    return OkedSearchOut(
        query=q,
        items=[
            OkedItemOut(
                code=r.code,
                name_ru=r.name_ru,
                parent_code=r.parent_code,
                level=r.level,
            )
            for r in rows
        ],
    )


@router.get("/popular", response_model=list[OkedItemOut], summary="Популярные ОКЭД для SMB")
async def oked_popular(
    limit: int = Query(15, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> list[OkedItemOut]:
    await seed_popular_oked_if_empty(db)
    rows = await search_oked(db, "", limit=limit)
    return [
        OkedItemOut(code=r.code, name_ru=r.name_ru, parent_code=r.parent_code, level=r.level)
        for r in rows
    ]
