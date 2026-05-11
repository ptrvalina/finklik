"""Вывод OperationalHealthScore из FinancialState и governance (Flow 9)."""

from __future__ import annotations

from app.schemas.financial_state import FinancialState, StatePrediction
from app.schemas.flow9_operational_health import OperationalHealthScore
from app.schemas.state_governance import TruthGovernanceOverlay


def _liquidity_score(fs: FinancialState) -> int:
    return {"healthy": 92, "tight": 58, "critical": 28}[fs.cashflow_state.level]


def _reporting_stability_score(fs: FinancialState) -> int:
    return {"ready": 95, "preparing": 78, "at_risk": 48, "blocked": 22}[fs.reporting_status.status]


def _consistency_score(fs: FinancialState, truth: TruthGovernanceOverlay | None) -> int:
    base = 100
    if truth:
        base -= min(48, len(truth.conflicts) * 14)
        base -= min(36, len(truth.governance_violations) * 9)
        base -= max(0, int((1.0 - truth.state_confidence) * 35))
    n_blockers = len(fs.reporting_status.blocker_codes)
    base -= min(30, n_blockers * 7)
    return max(0, min(100, base))


def _operational_load_score(open_item_count: int, fs: FinancialState) -> int:
    """Чем меньше открытых сигналов и блокеров — тем выше «здоровье нагрузки»."""
    penalty = min(85, open_item_count * 5)
    if fs.compliance_state.level == "blocked":
        penalty += 12
    if fs.risk_level == "critical":
        penalty += 15
    return max(0, 100 - penalty)


def _automation_stability_score(truth: TruthGovernanceOverlay | None, fs: FinancialState) -> int:
    if truth:
        v = int(round(truth.state_confidence * 100))
    else:
        v = 72
    if fs.risk_level in ("high", "critical"):
        v = max(0, v - 22)
    if truth and truth.conflicts:
        v = max(0, v - 10 * min(4, len(truth.conflicts)))
    return max(0, min(100, v))


def _summary_plain(fs: FinancialState, composite: int) -> str:
    if composite >= 82:
        return "Операции выглядят устойчиво — можно спокойно закрывать рутину и готовить отчётность."
    if composite >= 65:
        return "Есть зоны внимания, но система управляема — лучше закрыть главные блокеры по очереди."
    if composite >= 45:
        return "Нагрузка и риски заметны — стоит сфокусироваться на отчётности, документах и кассе."
    return "Сейчас напряжённый режим — важно не распыляться и идти от самых критичных задач."


def compute_operational_health(
    fs: FinancialState,
    truth: TruthGovernanceOverlay | None,
    *,
    open_operational_item_count: int,
    predictions: list[StatePrediction],
) -> OperationalHealthScore:
    readiness = fs.operational_readiness.score
    consistency = _consistency_score(fs, truth)
    liquidity = _liquidity_score(fs)
    reporting_stability = _reporting_stability_score(fs)
    operational_load = _operational_load_score(open_operational_item_count, fs)
    automation_stability = _automation_stability_score(truth, fs)

    risk_pen = sum(1 for p in predictions if p.severity == "risk")
    if risk_pen:
        reporting_stability = max(0, reporting_stability - min(25, risk_pen * 8))
        readiness = max(0, readiness - min(20, risk_pen * 5))

    parts = [
        readiness,
        consistency,
        liquidity,
        reporting_stability,
        operational_load,
        automation_stability,
    ]
    composite = int(round(sum(parts) / len(parts)))

    return OperationalHealthScore(
        readiness=readiness,
        consistency=consistency,
        liquidity=liquidity,
        reporting_stability=reporting_stability,
        operational_load=operational_load,
        automation_stability=automation_stability,
        composite=composite,
        summary_plain=_summary_plain(fs, composite),
    )
