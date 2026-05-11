"""Спокойный операционный слой отчётности: готовность, проверки, единая шкала времени."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.financial_state import FinancialState, StatePrediction

Severity = Literal["info", "attention", "risk"]
TimelineState = Literal["draft", "preparing", "ready", "needs_attention", "submitted", "overdue"]
ConfidenceLevel = Literal["high", "medium", "low"]


class ConsistencyIssue(BaseModel):
    id: str
    severity: Severity
    title: str
    detail: str
    fix_hint: str
    action_path: str | None = None


class ReadinessBlocker(BaseModel):
    code: str
    label: str
    impact_points: int


class ReadinessSummary(BaseModel):
    score: int = Field(ge=0, le=100)
    confidence: ConfidenceLevel
    blockers: list[ReadinessBlocker]
    suggested_fixes: list[str]


class TimelineItem(BaseModel):
    id: str
    kind: Literal["tax_calendar", "obligation", "submission", "payroll_hint"]
    title: str
    date: date
    state: TimelineState
    subtitle: str | None = None
    meta: str | None = None


class ObligationSummaryItem(BaseModel):
    id: str
    obligation_type: str
    amount: Decimal
    due_date: date
    status: str
    days_until_due: int | None = None


class ReportingCalmOverview(BaseModel):
    readiness: ReadinessSummary
    consistency_issues: list[ConsistencyIssue]
    timeline: list[TimelineItem]
    obligations_preview: list[ObligationSummaryItem]
    ai_summary: str
    generated_at: datetime
    #: Flow 6: тот же снимок, что и GET /operations/financial-state (без отдельной бизнес-логики).
    financial_state: FinancialState | None = None
    state_predictions: list[StatePrediction] = Field(default_factory=list)
