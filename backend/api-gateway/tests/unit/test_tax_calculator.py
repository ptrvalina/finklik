"""Unit tests for tax calculator service."""
import pytest
from decimal import Decimal
from datetime import date


class TestUSN:
    def test_usn_6_percent_with_vat_flag(self):
        from app.services.tax_calculator import calculate_usn
        result = calculate_usn(
            income=Decimal("10000"),
            period_start=date(2024, 1, 1),
            period_end=date(2024, 3, 31),
            with_vat=True,
        )
        assert result.usn_amount == Decimal("600.00")
        assert result.usn_to_pay == Decimal("600.00")
        assert result.deadline == date(2024, 4, 25)
        assert result.tax_regime == "usn_6_vat"

    def test_usn_6_percent_without_vat_flag(self):
        from app.services.tax_calculator import calculate_usn
        result = calculate_usn(
            income=Decimal("10000"),
            period_start=date(2024, 1, 1),
            period_end=date(2024, 3, 31),
            with_vat=False,
        )
        assert result.usn_amount == Decimal("600.00")
        assert result.tax_regime == "usn_6_no_vat"

    def test_usn_with_paid_before(self):
        from app.services.tax_calculator import calculate_usn
        result = calculate_usn(
            income=Decimal("10000"),
            period_start=date(2024, 1, 1),
            period_end=date(2024, 3, 31),
            with_vat=True,
            paid_before=Decimal("200"),
        )
        assert result.usn_to_pay == Decimal("400.00")


class TestVAT:
    def test_vat_calculation(self):
        from app.services.tax_calculator import calculate_vat
        vat_sales, vat_purchases, vat_to_pay, deadline = calculate_vat(
            sales_with_vat=Decimal("12000"),
            purchases_with_vat=Decimal("6000"),
            period_end=date(2024, 1, 31),
        )
        assert vat_sales == Decimal("2000.00")
        assert vat_purchases == Decimal("1000.00")
        assert vat_to_pay == Decimal("1000.00")
        assert deadline == date(2024, 2, 20)


class TestFSSZN:
    def test_fsszn_calculation(self):
        from app.services.tax_calculator import calculate_fsszn
        employer, employee, deadline = calculate_fsszn(
            fot=Decimal("1000"),
            period_end=date(2024, 3, 31),
        )
        assert employer == Decimal("340.00")
        assert employee == Decimal("10.00")


class TestSalary:
    def test_salary_no_children(self):
        from app.services.tax_calculator import calculate_salary
        result = calculate_salary(
            base_salary=Decimal("1000"),
            bonus=Decimal("0"),
            sick_days=0, vacation_days=0,
            work_days_plan=21, has_children=0, is_disabled=False,
        )
        assert result["gross_salary"] == Decimal("1000.00")
        assert result["income_tax"] == Decimal("130.00")
        assert result["net_salary"] == Decimal("860.00")

    def test_salary_with_child_deduction(self):
        from app.services.tax_calculator import calculate_salary
        no_child = calculate_salary(Decimal("1000"), Decimal("0"), 0, 0, 21, 0, False)
        with_child = calculate_salary(Decimal("1000"), Decimal("0"), 0, 0, 21, 1, False)
        assert with_child["income_tax"] < no_child["income_tax"]

    def test_sick_days_reduce_pay(self):
        from app.services.tax_calculator import calculate_salary
        full = calculate_salary(Decimal("1000"), Decimal("0"), 0, 0, 21, 0, False)
        sick = calculate_salary(Decimal("1000"), Decimal("0"), 5, 0, 21, 0, False)
        assert sick["gross_salary"] < full["gross_salary"]


class TestTaxCalendar:
    def test_generates_events(self):
        from app.services.tax_calculator import generate_tax_calendar
        events = generate_tax_calendar(2024)
        assert len(events) >= 4
        types = {e["event_type"] for e in events}
        assert "deadline" in types
        assert "report" in types


class TestTaxRulesConfig:
    def test_get_rules_for_known_year(self):
        from app.services.tax_calculator import get_tax_rules_for_year

        rules = get_tax_rules_for_year(2026)
        assert rules.year == 2026
        assert rules.version.startswith("RB-TAX-2026")

    def test_get_rules_fallback_to_nearest(self):
        from app.services.tax_calculator import get_tax_rules_for_year

        rules = get_tax_rules_for_year(2030)
        assert rules.year in (2024, 2025, 2026)
