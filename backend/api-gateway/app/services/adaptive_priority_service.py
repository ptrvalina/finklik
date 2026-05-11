"""Динамические приоритеты: давление, деградация, блокеры (Flow 9)."""

from __future__ import annotations

from app.schemas.financial_state import FinancialState, StatePrediction
from app.schemas.flow9_operational_health import OperationalHealthScore
from app.schemas.operations_feed import OperationalItem, OperationalItemType
from app.services.work_pack_service import infer_state_dimension

PRIORITY_RANK: dict[str, int] = {"critical": 4, "high": 3, "medium": 2, "low": 1}
TYPE_WEIGHT: dict[OperationalItemType, int] = {
    "reporting": 50,
    "reconciliation": 45,
    "document": 40,
    "approval": 35,
    "transaction": 30,
}


def adaptive_priority_sort(
    items: list[OperationalItem],
    fs: FinancialState,
    health: OperationalHealthScore,
    predictions: list[StatePrediction],
) -> list[OperationalItem]:
    risk_dims = {p.affected_dimension for p in predictions if p.severity == "risk"}
    pressure = max(0.0, min(1.0, (100 - health.readiness) / 100.0))

    def boost(it: OperationalItem) -> float:
        b = 0.0
        dim = it.state_dimension or infer_state_dimension(it)
        if dim in risk_dims:
            b += 2.8
        if pressure > 0.38 and dim == "reporting_status":
            b += 1.4
        if fs.compliance_state.level == "blocked" and dim == "compliance_state":
            b += 2.2
        if health.consistency < 52 and it.governance_tags:
            b += 1.1
        if pressure > 0.55 and it.priority == "critical":
            b += 0.8
        # Наследие state-aware сортировки (касса / отчётность / первичка).
        if fs.risk_level in ("critical", "high") and dim == "reporting_status":
            if fs.reporting_status.status in ("at_risk", "blocked"):
                b += 2.0
        if fs.document_completeness.score < 50 and dim == "document_completeness":
            b += 1.0
        return b

    def key(it: OperationalItem) -> tuple[float, int, str]:
        pr = PRIORITY_RANK.get(it.priority, 0) + boost(it)
        return (pr, TYPE_WEIGHT.get(it.type, 0), it.title)

    return sorted(items, key=key, reverse=True)
