"""Flow 10: доверие, надёжность и спокойный язык для пользователя (без «админки датацентра»)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CalmBackgroundJobCard(BaseModel):
    """Одна фоновая линия работы — без внутренних имён очередей."""

    id: str
    domain: Literal["sync", "ocr", "calendar", "reporting", "reconciliation", "ai_processing"]
    status_plain: str
    last_success_at: datetime | None = None
    last_attempt_at: datetime | None = None
    retry_count: int = 0
    duration_hint_plain: str | None = Field(None, description="Коротко, без миллисекунд профилирования.")
    failure_reason_plain: str | None = None


class StateConsistencyPlain(BaseModel):
    """Итог проверки согласованности FinancialState — без технических кодов."""

    snapshot_aligned_with_audit: bool
    message_plain: str
    stale_hint_plain: str | None = None


class OperationalConfidencePlain(BaseModel):
    """Высокоуровневая уверенность в работе платформы для организации."""

    level: Literal["high", "steady", "attention"]
    headline: str
    supporting_line: str | None = None


class SafeActionPrinciples(BaseModel):
    """Архитектурные обязательства по опасным действиям (справочно для клиента)."""

    undo_window_hint: str = "Где возможно, разрушающие действия оставляют след в журнале аудита; отмена — в разумном окне до фиксации периода."
    confirmation_hint: str = "Отправка отчётности, смена критичных статусов и массовые исправления требуют явного подтверждения."
    audit_reference_hint: str = "Ключевые изменения связываются с записями аудита и снимками состояния."
    rollback_hint: str = "Там, где безопасно для целостности данных, предусмотрены мягкие откаты через повторный расчёт состояния."


class BackupRecoveryReadiness(BaseModel):
    """Границы восстановления и экспорта — без реализации полного DR в одном PR."""

    snapshot_export_ready: bool = True
    restore_boundary_note: str = (
        "Операционные снимки состояния и аудит хранятся отдельно от сырого журнала; полное восстановление — по процедурам бэкапа БД."
    )
    migration_safety_note: str = "Миграции схемы проходят через Alembic; перед production — проверка head и откатного плана."


class TrustSurfaceResponse(BaseModel):
    """Спокойная поверхность доверия + фон без перегрузки цифрами."""

    trust_lines: list[str] = Field(default_factory=list)
    background_jobs: list[CalmBackgroundJobCard] = Field(default_factory=list)
    state_consistency: StateConsistencyPlain | None = None
    operational_confidence: OperationalConfidencePlain
    safe_actions: SafeActionPrinciples = Field(default_factory=SafeActionPrinciples)
    backup_recovery: BackupRecoveryReadiness = Field(default_factory=BackupRecoveryReadiness)
    state_etag: str | None = Field(None, description="Отпечаток снимка для If-None-Match / оптимистичной согласованности.")
