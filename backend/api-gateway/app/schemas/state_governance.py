"""Flow 7: правила истины, мутации состояния и аудит (governance layer)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

StateMutationLevel = Literal["system_auto", "ai_suggested", "user_confirmed", "frozen"]


class StateGovernanceRule(BaseModel):
    """Декларативное правило источника и приоритета для поля состояния."""

    state_field: str
    allowed_sources: list[str]
    validation_rule: str
    priority: int = Field(ge=0, le=1000)
    requires_confirmation: bool = False


class ConflictSignal(BaseModel):
    """Обнаруженное расхождение источников (не произвольное вычисление — классификация)."""

    id: str
    severity: Literal["low", "medium", "high"]
    title: str
    detail: str
    affected_dimensions: list[str]


class TruthGovernanceOverlay(BaseModel):
    """Наложение истины на FinancialState: уверенность, заморозки, конфликты, уровни мутаций."""

    governance_version: str = "flow7-v1"
    #: Агрегированная уверенность в снимке 0..1
    state_confidence: float = Field(ge=0.0, le=1.0)
    frozen_dimensions: list[str] = Field(default_factory=list)
    mutation_level_by_dimension: dict[str, StateMutationLevel] = Field(default_factory=dict)
    conflicts: list[ConflictSignal] = Field(default_factory=list)
    governance_violations: list[str] = Field(default_factory=list)
    rules_catalog: list[StateGovernanceRule] = Field(default_factory=list)


class StateAuditEntry(BaseModel):
    """Запись аудита изменения снимка состояния."""

    id: str
    previous_state_summary: str | None = None
    new_state_summary: str | None = None
    trigger_event: str
    source: str
    actor: str
    timestamp: datetime


