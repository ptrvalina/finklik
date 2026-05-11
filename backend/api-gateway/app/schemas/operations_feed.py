"""Единая модель операционной ленты исполнения (Flow 4 → 6: производная от FinancialState)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.financial_state import (
    AIActionMode,
    FinancialState,
    StateDimension,
    StatePrediction,
    WorkPack,
)

OperationalItemType = Literal["transaction", "document", "approval", "reporting", "reconciliation"]
OperationalPriority = Literal["low", "medium", "high", "critical"]
OperationalStatus = Literal["open", "in_progress", "resolved"]


class OperationalItem(BaseModel):
    id: str
    type: OperationalItemType
    priority: OperationalPriority
    status: OperationalStatus
    entity_id: str
    title: str
    context: str | None = None
    #: Глубокая ссылка в существующий экран (без новых модулей).
    action_path: str | None = None
    #: Короткое объяснение важности пункта (роль ИИ — приоритизация, не чат).
    ai_why: str | None = None
    #: Измерение канонического состояния (Flow 6).
    state_dimension: StateDimension | None = None
    #: Краткий сигнал перехода состояния при закрытии пункта.
    state_transition_hint: str | None = None


class ExecutionFeedResponse(BaseModel):
    items: list[OperationalItem]
    top_action: OperationalItem | None = None
    pending_count: int = 0
    blocked_count: int = 0
    readiness_score: int | None = Field(None, ge=0, le=100)
    ai_summary: str | None = None
    #: Канонический снимок — источник правды для ленты и приоритетов (Flow 6).
    financial_state: FinancialState | None = None
    work_packs: list[WorkPack] = Field(default_factory=list)
    state_predictions: list[StatePrediction] = Field(default_factory=list)
    default_autonomy_mode: AIActionMode = "suggest"


class WorkPackAckResponse(BaseModel):
    status: str = "acknowledged"
    pack_id: str
    hint: str = "Отметьте действия выполненными в связанных разделах; массовое проведение без вашего подтверждения не выполняется."
