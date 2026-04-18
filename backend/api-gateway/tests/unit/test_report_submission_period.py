from datetime import date
from decimal import Decimal

from app.api.v1.endpoints.report_submission import _fmt_byn, _parse_report_period


def test_parse_quarter():
    d0, d1, meta = _parse_report_period("2026-Q2")
    assert d0 == date(2026, 4, 1)
    assert d1 == date(2026, 6, 30)
    assert meta["kind"] == "quarter"
    assert meta["quarter"] == 2


def test_parse_month():
    d0, d1, meta = _parse_report_period("2026-M01")
    assert d0 == date(2026, 1, 1)
    assert d1 == date(2026, 1, 31)
    assert meta["kind"] == "month"
    assert meta["month"] == 1


def test_fmt_byn():
    assert "BYN" in _fmt_byn(Decimal("1234.50"))
