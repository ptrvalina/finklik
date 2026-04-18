"""Единая агрегация зарплаты для формы ПУ-3 (экспорт и подача отчёта)."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.models.employee import SalaryRecord


@dataclass(frozen=True)
class Pu3Aggregates:
    """Те же поля, что ожидает export_fsszn_pu3_txt (числа в float для печати)."""

    employees_data: list[dict]  # name, gross, employer, employee — float
    total_fot: Decimal
    total_employer: Decimal
    total_employee: Decimal


def build_pu3_aggregates(
    records: list[SalaryRecord],
    employee_id_to_name: dict[str, str],
) -> Pu3Aggregates:
    """
    Свертка строк salary_records по сотруднику — как в endpoints/export.py для ПУ-3.
    """
    agg: dict[str, dict[str, float]] = {}
    for r in records:
        if r.employee_id not in agg:
            agg[r.employee_id] = {"name": employee_id_to_name.get(r.employee_id, "—"), "gross": 0.0, "employer": 0.0, "employee": 0.0}
        agg[r.employee_id]["gross"] += float(r.gross_salary)
        agg[r.employee_id]["employer"] += float(r.fsszn_employer)
        agg[r.employee_id]["employee"] += float(r.fsszn_employee)

    employees_data = sorted(agg.values(), key=lambda x: x["name"])
    total_fot = Decimal(str(sum(e["gross"] for e in employees_data))).quantize(Decimal("0.01"))
    total_employer = Decimal(str(sum(e["employer"] for e in employees_data))).quantize(Decimal("0.01"))
    total_employee = Decimal(str(sum(e["employee"] for e in employees_data))).quantize(Decimal("0.01"))

    return Pu3Aggregates(
        employees_data=employees_data,
        total_fot=total_fot,
        total_employer=total_employer,
        total_employee=total_employee,
    )
