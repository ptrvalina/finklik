"""Единая модель операционной ленты исполнения (Flow 4 → 6: производная от FinancialState)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.experience import ProgressiveExperienceMeta
from app.schemas.flow9_automation import (
    CalmUiBudget,
    TrustedAutomationProfile,
    WorkflowMaintenanceSuggestion,
)
from app.schemas.flow9_operational_health import OperationalHealthScore
from app.schemas.financial_state import (
    AIActionMode,
    FinancialState,
    StateDimension,
    StatePrediction,
    WorkPack,
)
from app.schemas.state_governance import StateAuditEntry, TruthGovernanceOverlay

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
    #: Flow 7: метки истины (конфликт, заморозка, подтверждение).
    governance_tags: list[str] = Field(default_factory=list)
    truth_confidence: float | None = Field(None, ge=0.0, le=1.0)


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
    truth_governance: TruthGovernanceOverlay | None = None
    recent_state_audit: list[StateAuditEntry] = Field(default_factory=list)
    #: Flow 8.5: режим опыта и упрощённое описание состояния без дублирования экранов.
    progressive_experience: ProgressiveExperienceMeta | None = None
    #: Flow 9: здоровье операций, доверие к автоматизации, самообслуживание и память — координированно с лентой.
    operational_health: OperationalHealthScore | None = None
    trusted_automation: TrustedAutomationProfile | None = None
    workflow_maintenance: list[WorkflowMaintenanceSuggestion] = Field(default_factory=list)
    operational_memory_hints: list[str] = Field(default_factory=list)
    calm_ui_budget: CalmUiBudget = Field(default_factory=CalmUiBudget)


class WorkPackAckResponse(BaseModel):
    status: str = "acknowledged"
    pack_id: str
    hint: str = "Отметьте действия выполненными в связанных разделах; массовое проведение без вашего подтверждения не выполняется."
