from decimal import Decimal
from types import SimpleNamespace

from app.services.pu3_aggregation import build_pu3_aggregates


def test_build_pu3_aggregates_merges_same_employee():
    records = [
        SimpleNamespace(
            employee_id="e1",
            gross_salary=Decimal("100.00"),
            fsszn_employer=Decimal("34.00"),
            fsszn_employee=Decimal("1.00"),
        ),
        SimpleNamespace(
            employee_id="e1",
            gross_salary=Decimal("100.00"),
            fsszn_employer=Decimal("34.00"),
            fsszn_employee=Decimal("1.00"),
        ),
    ]
    out = build_pu3_aggregates(records, {"e1": "Петров П.П."})
    assert len(out.employees_data) == 1
    assert out.employees_data[0]["name"] == "Петров П.П."
    assert out.employees_data[0]["gross"] == 200.0
    assert out.total_fot == Decimal("200.00")
    assert out.total_employer == Decimal("68.00")
    assert out.total_employee == Decimal("2.00")
