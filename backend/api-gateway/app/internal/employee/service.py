"""Employee domain services."""

from __future__ import annotations

import json
from datetime import date, datetime, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.internal.crypto.encrypt import get_aes_gcm_encryptor
from app.models.employee import Employee
from app.models.user import Organization
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

    async def _get_org(self, tenant_id: str) -> Organization:
        r = await self.db.execute(select(Organization).where(Organization.id == tenant_id))
        org = r.scalar_one_or_none()
        if org is None:
            raise ValueError("organization_not_found")
        return org

    def _merge_hr_meta(self, employee: Employee, patch: dict) -> None:
        meta: dict = {}
        if employee.hr_meta_json:
            try:
                meta = json.loads(employee.hr_meta_json)
            except json.JSONDecodeError:
                meta = {}
        meta.update(patch)
        employee.hr_meta_json = json.dumps(meta, ensure_ascii=False, default=str)

    async def _terminate_employee_core(
        self,
        employee: Employee,
        termination_date: date,
        fire_order_number: str,
        fire_seq: int,
        dismissal_reason_code: str | None,
        dismissal_reason_label: str | None,
    ) -> None:
        employee.is_active = False
        employee.fire_date = termination_date
        employee.terminated_at = datetime.now(timezone.utc)
        patch = {
            "termination_date": termination_date.isoformat(),
            "fire_order_number": fire_order_number,
            "fire_order_seq_auto": str(fire_seq),
        }
        if dismissal_reason_code:
            patch["dismissal_reason_code"] = dismissal_reason_code
        if dismissal_reason_label:
            patch["dismissal_reason_label"] = dismissal_reason_label
        self._merge_hr_meta(employee, patch)

    async def TerminateEmployee(
        self,
        tenant_id: str,
        employee_id: str,
        termination_date: date,
        *,
        dismissal_reason_code: str | None = None,
        dismissal_reason_label: str | None = None,
        fire_order_number_override: str | None = None,
    ) -> None:
        """Увольнение одного сотрудника; номер приказа — следующий в организации."""
        employee = await self.GetEmployeeByID(tenant_id, employee_id)
        org = await self._get_org(tenant_id)
        org.hr_fire_order_seq = (org.hr_fire_order_seq or 0) + 1
        seq = org.hr_fire_order_seq
        num = fire_order_number_override if fire_order_number_override is not None else str(seq)
        await self._terminate_employee_core(
            employee,
            termination_date,
            num,
            seq,
            dismissal_reason_code,
            dismissal_reason_label,
        )
        await self.db.flush()
        self.log.info("employee_terminated", tenant_id=tenant_id, employee_id=employee_id, fire_seq=seq)

    async def TerminateEmployeesBulk(
        self,
        tenant_id: str,
        employee_ids: list[str],
        termination_date: date,
        *,
        dismissal_reason_code: str | None = None,
        dismissal_reason_label: str | None = None,
        fire_order_number_override: str | None = None,
    ) -> None:
        """Несколько сотрудников одним приказом (один порядковый номер)."""
        org = await self._get_org(tenant_id)
        org.hr_fire_order_seq = (org.hr_fire_order_seq or 0) + 1
        seq = org.hr_fire_order_seq
        num = fire_order_number_override if fire_order_number_override is not None else str(seq)
        for eid in employee_ids:
            employee = await self.GetEmployeeByID(tenant_id, eid)
            await self._terminate_employee_core(
                employee,
                termination_date,
                num,
                seq,
                dismissal_reason_code,
                dismissal_reason_label,
            )
        await self.db.flush()
        self.log.info(
            "employees_bulk_terminated",
            tenant_id=tenant_id,
            count=len(employee_ids),
            fire_seq=seq,
        )

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
