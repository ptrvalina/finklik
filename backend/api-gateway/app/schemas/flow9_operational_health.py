"""Flow 9: непрерывная оценка «насколько спокойно идут операции» (без отдельного ML)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class OperationalHealthScore(BaseModel):
    """Шесть измерений 0–100; выше — здоровее / спокойнее для бизнеса."""

    readiness: int = Field(ge=0, le=100, description="Готовность данных и процессов.")
    consistency: int = Field(ge=0, le=100, description="Согласованность источников и правил истины.")
    liquidity: int = Field(ge=0, le=100, description="Кассовый комфорт.")
    reporting_stability: int = Field(ge=0, le=100, description="Устойчивость отчётного контура.")
    operational_load: int = Field(
        ge=0,
        le=100,
        description="Насколько управляема текущая нагрузка (выше — легче переработать очередь).",
    )
    automation_stability: int = Field(ge=0, le=100, description="Насколько безопасно опираться на автоматизацию.")
    composite: int = Field(ge=0, le=100)
    summary_plain: str = Field(..., description="Одна спокойная фраза без внутренних имён полей.")
