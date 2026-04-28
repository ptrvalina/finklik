"""Salary calculation service."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class SalaryCalculator:
    """Calculates salaries and persists to salary_calculations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def CalculateSalary(
        self,
        tenant_id: str,
        employee_id: str,
        period_start: date,
        period_end: date,
    ) -> dict:
        """Calculate salary totals for period and persist draft calculation."""
        _ = period_end
        row = await self.db.execute(
            text("SELECT salary FROM employees WHERE id = :employee_id AND organization_id = :tenant_id"),
            {"employee_id": employee_id, "tenant_id": tenant_id},
        )
        source = row.first()
        if source is None:
            raise ValueError("employee_not_found")

        base_salary = Decimal(str(source[0]))
        bonuses = Decimal("0")
        deductions = Decimal("0")
        taxes = (base_salary + bonuses - deductions) * Decimal("0.13")
        net_salary = base_salary + bonuses - deductions - taxes

        calc_id = str(uuid.uuid4())
        await self.db.execute(
            text(
                """
                INSERT INTO salary_calculations
                (id, employee_id, period, base_salary, bonuses, deductions, taxes, net_salary, status)
                VALUES (:id, :employee_id, :period, :base_salary, :bonuses, :deductions, :taxes, :net_salary, :status)
                """
            ),
            {
                "id": calc_id,
                "employee_id": employee_id,
                "period": period_start,
                "base_salary": base_salary,
                "bonuses": bonuses,
                "deductions": deductions,
                "taxes": taxes,
                "net_salary": net_salary,
                "status": "draft",
            },
        )
        return {
            "id": calc_id,
            "employee_id": employee_id,
            "period": period_start,
            "base_salary": base_salary,
            "bonuses": bonuses,
            "deductions": deductions,
            "taxes": taxes,
            "net_salary": net_salary,
            "status": "draft",
        }

    async def CalculateVacationPay(self, tenant_id: str, employee_id: str, days: int) -> float:
        """Calculate vacation pay based on average daily salary."""
        row = await self.db.execute(
            text("SELECT salary FROM employees WHERE id = :employee_id AND organization_id = :tenant_id"),
            {"employee_id": employee_id, "tenant_id": tenant_id},
        )
        source = row.first()
        if source is None:
            raise ValueError("employee_not_found")
        avg_day = Decimal(str(source[0])) / Decimal("29.7")
        return float(avg_day * Decimal(days))

    async def CalculateSickPay(self, tenant_id: str, employee_id: str, days: int, avg_salary: float) -> float:
        """Calculate sick pay with 80% coefficient."""
        _ = tenant_id
        _ = employee_id
        amount = Decimal(str(avg_salary)) * Decimal(days) * Decimal("0.8")
        return float(amount)
