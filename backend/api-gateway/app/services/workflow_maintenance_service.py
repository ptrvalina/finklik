"""Самообслуживающиеся сценарии: подсказки системы, а не скрытый автопилот (Flow 9)."""

from __future__ import annotations

from app.schemas.financial_state import FinancialState
from app.schemas.flow9_automation import WorkflowMaintenanceSuggestion
from app.schemas.reporting_calm import ReportingCalmOverview


def build_workflow_maintenance_suggestions(
    fs: FinancialState,
    overview: ReportingCalmOverview,
) -> list[WorkflowMaintenanceSuggestion]:
    out: list[WorkflowMaintenanceSuggestion] = []

    if overview.readiness.score < 80:
        out.append(
            WorkflowMaintenanceSuggestion(
                id="maint-readiness-watch",
                kind="reminder",
                title="Напоминание до просадки готовности",
                detail="Закройте замечания журнала и первички, пока готовность не ушла ниже комфортного порога.",
            )
        )

    if fs.document_completeness.pending_ocr > 2:
        out.append(
            WorkflowMaintenanceSuggestion(
                id="maint-ocr-batch",
                kind="group",
                title="Собрать очередь распознавания в один проход",
                detail=f"В очереди {fs.document_completeness.pending_ocr} документов — лучше обработать пакетом, чтобы не копить разрыв в учёте.",
            )
        )

    out.append(
        WorkflowMaintenanceSuggestion(
            id="maint-pack-order",
            kind="repack",
            title="Упорядочить пакеты по срочности",
            detail="Пакеты работ пересортированы по убыванию влияния на отчётность и дедлайны.",
        )
    )

    out.append(
        WorkflowMaintenanceSuggestion(
            id="maint-noise-collapse",
            kind="collapse",
            title="Скрыть повторяющиеся сигналы в ленте",
            detail="Одинаковые по сути пункты схлопнуты до одного приоритетного, чтобы не размножать тревогу.",
        )
    )

    if overview.readiness.suggested_fixes:
        out.append(
            WorkflowMaintenanceSuggestion(
                id="maint-simplify",
                kind="simplify",
                title="Упростить следующий шаг",
                detail=overview.readiness.suggested_fixes[0][:280],
            )
        )

    return out[:8]
