"""Каноническая финансовая модель состояния (Flow 6) — единый источник правды для производных UI."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.state_governance import StateAuditEntry, TruthGovernanceOverlay

AIActionMode = Literal["observe", "suggest", "prepare", "execute_with_approval"]

StateDimension = Literal[
    "cashflow_state",
    "operational_readiness",
    "compliance_state",
    "document_completeness",
    "reporting_status",
]


class CashflowStateBlock(BaseModel):
    """Производная от журнала и обязательств (не дублирует BusinessState, а интерпретирует)."""

    level: Literal["healthy", "tight", "critical"]
    monthly_net: Decimal
    health_signal: Literal["ok", "warning", "risk"]
    summary: str


class OperationalReadinessBlock(BaseModel):
    score: int = Field(ge=0, le=100)
    confidence: Literal["high", "medium", "low"]
    label: str


class ComplianceStateBlock(BaseModel):
    level: Literal["clear", "attention", "blocked"]
    pending_approvals: int
    overdue_obligations: int
    open_inbox_items: int
    summary: str


class DocumentCompletenessBlock(BaseModel):
    score: int = Field(ge=0, le=100)
    pending_ocr: int
    needs_review: int
    low_confidence_unconfirmed: int
    summary: str


class ReportingStatusBlock(BaseModel):
    status: Literal["ready", "preparing", "at_risk", "blocked"]
    readiness_score: int = Field(ge=0, le=100)
    blocker_codes: list[str] = Field(default_factory=list)
    summary: str


class FinancialState(BaseModel):
    cashflow_state: CashflowStateBlock
    operational_readiness: OperationalReadinessBlock
    compliance_state: ComplianceStateBlock
    document_completeness: DocumentCompletenessBlock
    reporting_status: ReportingStatusBlock
    risk_level: Literal["low", "medium", "high", "critical"]
    derived_at: datetime


class StatePrediction(BaseModel):
    """Прогноз деградации состояния (лёгкая эвристика, без отдельного ML-сервиса)."""

    id: str
    horizon_days: int
    message: str
    affected_dimension: StateDimension
    severity: Literal["info", "warning", "risk"]


class WorkPackLine(BaseModel):
    kind: str
    count: int
    detail: str | None = None


class WorkPack(BaseModel):
    """Сгруппированный пакет подготовленных действий (Flow 5); исполнение остаётся за пользователем."""

    id: str
    title: str
    mode: AIActionMode
    summary_lines: list[WorkPackLine]
    operational_item_ids: list[str]
    recommended_action: str
    expected_outcome: str
    risk_if_ignored: str
    primary_action_path: str | None = None


class FinancialStateBundle(BaseModel):
    """Ответ API: состояние + режим автономности по умолчанию."""

    state: FinancialState
    #: Flow 10: отпечаток для оптимистичной согласованности клиента (If-Match / сравнение перед тяжёлыми действиями).
    state_fingerprint: str | None = None
    default_autonomy_mode: AIActionMode = "suggest"
    predictions: list[StatePrediction] = Field(default_factory=list)
    truth_governance: TruthGovernanceOverlay | None = None
    recent_state_audit: list[StateAuditEntry] = Field(default_factory=list)
