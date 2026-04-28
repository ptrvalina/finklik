"""Employee domain services."""

from __future__ import annotations

from datetime import date, datetime, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.internal.crypto.encrypt import get_aes_gcm_encryptor
from app.models.employee import Employee
from app.schemas.workforce import EmployeeCreateRequest
from app.security import get_encryptor


class EmployeeService:
    """Service for employee CRUD operations with PII encryption."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.pii_encryptor = get_aes_gcm_encryptor()
        self.name_encryptor = get_encryptor()
        self.log = structlog.get_logger().bind(component="employee_service")

    async def CreateEmployee(self, tenant_id: str, req: EmployeeCreateRequest) -> Employee:
        """Create employee and encrypt all personal data before persistence."""
        self.log.info("employee_create_started", tenant_id=tenant_id, position_code=req.position_code)
        employee = Employee(
            organization_id=tenant_id,
            tenant_id=tenant_id,
            full_name_enc=self.name_encryptor.encrypt(req.full_name),
            passport_data=self.pii_encryptor.encrypt(req.passport_data),
            phone=self.pii_encryptor.encrypt(req.phone),
            email=self.pii_encryptor.encrypt(str(req.email)),
            address=self.pii_encryptor.encrypt(req.address),
            position=req.position_name,
            position_code=req.position_code,
            position_name=req.position_name,
            salary=req.salary,
            hire_date=req.hire_date,
            is_active=True,
        )
        self.db.add(employee)
        await self.db.flush()
        self.log.info("employee_create_completed", tenant_id=tenant_id, employee_id=str(employee.id))
        return employee

    async def TerminateEmployee(self, tenant_id: str, employee_id: str, termination_date: date) -> None:
        """Mark employee as terminated by setting fire_date and terminated_at."""
        employee = await self.GetEmployeeByID(tenant_id, employee_id)
        employee.is_active = False
        employee.fire_date = termination_date
        employee.terminated_at = datetime.now(timezone.utc)
        await self.db.flush()
        self.log.info("employee_terminated", tenant_id=tenant_id, employee_id=employee_id)

    async def GetEmployees(self, tenant_id: str) -> list[Employee]:
        """Return all employees for tenant ordered by creation date."""
        result = await self.db.execute(
            select(Employee).where(Employee.organization_id == tenant_id).order_by(Employee.created_at.desc())
        )
        return list(result.scalars().all())

    async def GetEmployeeByID(self, tenant_id: str, employee_id: str) -> Employee:
        """Get single employee by tenant and ID."""
        result = await self.db.execute(
            select(Employee).where(
                Employee.organization_id == tenant_id,
                Employee.id == employee_id,
            )
        )
        employee = result.scalar_one_or_none()
        if employee is None:
            raise ValueError("employee_not_found")
        return employee
