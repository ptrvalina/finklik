"""Профиль доверия к автоматизации: без полной автономии, с явными границами (Flow 9)."""

from __future__ import annotations

from app.schemas.financial_state import AIActionMode, FinancialState
from app.schemas.flow9_automation import AutomationTrustLevel, TrustedAutomationProfile
from app.schemas.state_governance import TruthGovernanceOverlay
from app.services.financial_state_service import infer_autonomy_mode


def _level_from_signals(fs: FinancialState, truth: TruthGovernanceOverlay | None) -> AutomationTrustLevel:
    conf = truth.state_confidence if truth else 0.78
    conflicts = len(truth.conflicts) if truth else 0

    if fs.risk_level in ("high", "critical"):
        return "prepare_only"
    if conflicts > 0 or conf < 0.55:
        return "observe_only"
    if conf < 0.72 or fs.compliance_state.level == "blocked":
        return "suggest_only"
    if conf >= 0.88 and fs.risk_level == "low" and conflicts == 0 and fs.reporting_status.status in (
        "ready",
        "preparing",
    ):
        return "auto_execute_safe"
    if conf >= 0.72:
        return "prepare_only"
    return "suggest_only"


def build_trusted_automation_profile(
    fs: FinancialState,
    truth: TruthGovernanceOverlay | None,
) -> TrustedAutomationProfile:
    legacy = infer_autonomy_mode(fs)
    level = _level_from_signals(fs, truth)

    # Не повышаем доверие выше уровня, совместимого с legacy-режимом при высоком риске.
    if legacy == "execute_with_approval" and level == "auto_execute_safe":
        level = "prepare_only"

    allowed: list[str] = []
    if level in ("prepare_only", "auto_execute_safe"):
        allowed.append("Группировка и скрытие дубликатов в операционной ленте")
    if level in ("suggest_only", "prepare_only", "auto_execute_safe"):
        allowed.append("Напоминания до просадки готовности отчётности")
    if level in ("prepare_only", "auto_execute_safe"):
        allowed.append("Автосортировка пакетов работ по срочности")
    if level == "auto_execute_safe":
        allowed.extend(
            [
                "Автокатегоризация расходов при высокой уверенности ИИ",
                "Автосвязывание OCR с операциями при сильной уверенности распознавания",
                "Автоархивация закрытых уведомлений без бизнес-эффекта",
            ]
        )
    elif level == "prepare_only":
        allowed.append("Подготовка черновых действий без отправки и без проведения")

    restricted = [
        "Отправка отчётности и регламентных пакетов",
        "Обход правил комплаенса и ручных заморозок",
        "Снятие заморозки состояния и принудительные исправления снимка",
        "Финансовые корректировки с откатом и массовое удаление",
        "Любые деструктивные операции в журнале",
    ]

    rationale = (
        "Уровень доверия снижается при конфликтах источников, низкой уверенности или высоком операционном риске. "
        "Критичные действия всегда остаются за подтверждением человека."
    )

    return TrustedAutomationProfile(
        trust_level=level,
        legacy_ai_action_mode=legacy,
        allowed_auto_actions=allowed,
        always_require_confirmation=restricted,
        rationale_plain=rationale,
    )
