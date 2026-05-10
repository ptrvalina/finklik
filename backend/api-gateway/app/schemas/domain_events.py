"""API-схемы для параллельного слоя событий (не заменяют CRUD-ответы)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.business_os import BusinessStateResponse


class DomainEventOut(BaseModel):
    id: str
    event_type: str
    actor: str
    target_id: str
    target_kind: str | None
    payload: dict[str, Any]
    occurred_at_ms: int


class DerivedStatePreview(BaseModel):
    """Проекция поверх CRUD: бизнес-снимок из сервиса + последние инсайты из журнала событий."""

    business_state: BusinessStateResponse
    insights: list[DomainEventOut] = Field(default_factory=list)
