"""Схемы Business OS: доменные сущности, снимок состояния, структурированный вывод ИИ."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


# ── Домен ────────────────────────────────────────────────────────────────────


class BusinessEntityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    entity_type: str = Field(..., pattern="^(client|supplier|internal)$")
    counterparty_id: str | None = None


class BusinessEntityResponse(BaseModel):
    id: str
    name: str
    entity_type: str
    counterparty_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CostCenterCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    center_type: str = Field(
        ...,
        pattern="^(marketing|rent|salary|operations|tax|other)$",
    )


class CostCenterResponse(BaseModel):
    id: str
    name: str
    center_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RevenueStreamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    source: str | None = Field(None, max_length=500)


class RevenueStreamResponse(BaseModel):
    id: str
    name: str
    source: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FinancialObligationCreate(BaseModel):
    obligation_type: str = Field(..., pattern="^(tax|invoice|salary|rent)$")
    amount: Decimal = Field(..., ge=0)
    due_date: date
    status: str = Field(default="pending", pattern="^(pending|paid|overdue)$")
    linked_transaction_ids: list[str] = Field(default_factory=list)
    notes: str | None = None


class FinancialObligationUpdate(BaseModel):
    obligation_type: str | None = Field(None, pattern="^(tax|invoice|salary|rent)$")
    amount: Decimal | None = Field(None, ge=0)
    due_date: date | None = None
    status: str | None = Field(None, pattern="^(pending|paid|overdue)$")
    linked_transaction_ids: list[str] | None = None
    notes: str | None = None


class FinancialObligationResponse(BaseModel):
    id: str
    obligation_type: str
    amount: Decimal
    due_date: date
    status: str
    linked_transaction_ids: list[str]
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReconciliationMatchCreate(BaseModel):
    transaction_id: str
    document_id: str
    confidence: Decimal = Field(default=Decimal("0.8"), ge=0, le=1)
    status: str = Field(default="suggested", pattern="^(suggested|confirmed|rejected)$")


class ReconciliationMatchResponse(BaseModel):
    id: str
    transaction_id: str
    document_id: str
    confidence: Decimal
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkflowActionCreate(BaseModel):
    action_type: str = Field(..., max_length=40)
    target_id: str
    target_kind: str = Field(..., max_length=40)
    status: str = Field(default="completed", max_length=20)
    metadata_json: str | None = None


class WorkflowActionResponse(BaseModel):
    id: str
    action_type: str
    target_id: str
    target_kind: str
    status: str
    performed_by_user_id: str | None
    metadata_json: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AIMemoryEntryCreate(BaseModel):
    memory_type: str = Field(..., max_length=40)
    payload_json: str


class AIMemoryEntryResponse(BaseModel):
    id: str
    memory_type: str
    payload_json: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CategoryMetric(BaseModel):
    category: str
    amount: Decimal


class BusinessStateResponse(BaseModel):
    """Агрегированный снимок бизнес-состояния (единая точка для дашборда и интеграций)."""

    total_revenue: Decimal
    total_expenses: Decimal
    profit: Decimal
    cashflow_net: Decimal
    monthly_revenue: Decimal
    monthly_expenses: Decimal
    top_expense_categories: list[CategoryMetric]
    financial_health_status: str = Field(..., pattern="^(ok|warning|risk)$")
    pending_obligations_count: int
    overdue_obligations_count: int
    updated_at: datetime


class AIAnalysisResponse(BaseModel):
    """Структурированный вывод анализа операции (правила + эвристики; LLM может дополнять позже)."""

    suggested_category: str | None
    confidence: Decimal
    reasoning: str
    risk_level: str = Field(..., pattern="^(low|medium|high)$")
    business_context: str
    alternative_suggestions: list[str] = Field(default_factory=list)
