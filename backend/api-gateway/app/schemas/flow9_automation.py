"""Flow 9: доверенная автоматизация и обслуживающие сценарии — границы, не «автономный ERP»."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.financial_state import AIActionMode

AutomationTrustLevel = Literal["observe_only", "suggest_only", "prepare_only", "auto_execute_safe"]

WorkflowMaintenanceKind = Literal["reminder", "group", "repack", "collapse", "simplify"]


class WorkflowMaintenanceSuggestion(BaseModel):
    id: str
    kind: WorkflowMaintenanceKind
    title: str
    detail: str


class TrustedAutomationProfile(BaseModel):
    """Уровень доверия + явные списки разрешённого без подтверждения и всегда требующего подтверждения."""

    trust_level: AutomationTrustLevel
    #: Совместимость с существующим режимом автономности ИИ (Flow 5–6).
    legacy_ai_action_mode: AIActionMode
    allowed_auto_actions: list[str] = Field(default_factory=list)
    always_require_confirmation: list[str] = Field(default_factory=list)
    rationale_plain: str


class CalmUiBudget(BaseModel):
    """Мягкие лимиты одновременной «шумности» интерфейса (под мобильный контур)."""

    max_visible_alerts: int = Field(default=3, ge=1, le=12)
    max_parallel_priorities: int = Field(default=1, ge=1, le=5)
    dominant_next_action_enforced: bool = True
