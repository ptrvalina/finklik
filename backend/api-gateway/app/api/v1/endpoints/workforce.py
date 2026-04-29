"""Stage-3 workforce endpoints: employees, FSZN, salary."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.internal.audit.service import safe_log_audit
from app.internal.employee.service import EmployeeService
from app.internal.fszn.client import FsznClient
from app.internal.salary.calculator import SalaryCalculator
from app.models.user import User
from app.schemas.workforce import (
    FsznRequest,
    FsznResponse,
    SalaryCalculationDTO,
    SalaryCalculationRequest,
    TerminateEmployeeRequest,
)

router = APIRouter(
    tags=["workforce"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
    responses={401: {"description": "Unauthorized"}, 403: {"description": "Forbidden"}},
)
log = structlog.get_logger()


@router.post(
    "/employees/{employee_id}/terminate",
    summary="Terminate employee",
    description="Sets termination date and marks employee as inactive for current tenant.",
    responses={404: {"description": "Employee not found"}},
)
async def terminate_employee(
    employee_id: str,
    req: TerminateEmployeeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Terminate employee and set termination timestamp."""
    service = EmployeeService(db)
    log.info("employee_terminate_requested", employee_id=employee_id, user_id=str(current_user.id))
    try:
        await service.TerminateEmployee(current_user.organization_id, employee_id, req.termination_date)
    except ValueError:
        raise HTTPException(status_code=404, detail="Employee not found")
    await safe_log_audit(
        db=db,
        user_id=str(current_user.id),
        action="employee_terminate",
        entity_type="employee",
        entity_id=employee_id,
        metadata={"termination_date": req.termination_date.isoformat()},
    )
    log.info("employee_terminated", employee_id=employee_id, user_id=str(current_user.id))
    return {"status": "ok"}


@router.post(
    "/fszn/pu2",
    response_model=FsznResponse,
    summary="Send FSZN PU-2 report",
    description="Stores PU-2 submission row and returns protocol id/status from FSZN client.",
)
async def send_pu2(
    req: FsznRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit PU-2 report via FSZN client stub."""
    client = FsznClient()
    log.info("fszn_pu2_requested", user_id=str(current_user.id), employee_id=req.employee_id)
    protocol_id, status = await client.SendPu2(req.model_dump())
    report_id = protocol_id
    await db.execute(
        text(
            """
            INSERT INTO fszn_reports (id, tenant_id, report_type, period, xml_data, status, protocol_id, sent_at)
            VALUES (:id, :tenant_id, :report_type, :period, :xml_data, :status, :protocol_id, CURRENT_TIMESTAMP)
            """
        ),
        {
            "id": report_id,
            "tenant_id": current_user.organization_id,
            "report_type": "pu2",
            "period": req.period,
            "xml_data": req.xml_data,
            "status": status,
            "protocol_id": protocol_id,
        },
    )
    await safe_log_audit(
        db=db,
        user_id=str(current_user.id),
        action="fszn_send_pu2",
        entity_type="fszn_report",
        entity_id=report_id,
        metadata={"status": status},
    )
    log.info("fszn_pu2_completed", protocol_id=protocol_id, status=status, user_id=str(current_user.id))
    return FsznResponse(protocol_id=protocol_id, status=status)


@router.post(
    "/fszn/pu3",
    response_model=FsznResponse,
    summary="Send FSZN PU-3 report",
    description="Stores PU-3 submission row and returns protocol id/status from FSZN client.",
)
async def send_pu3(
    req: FsznRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit PU-3 report via FSZN client stub."""
    client = FsznClient()
    log.info("fszn_pu3_requested", user_id=str(current_user.id), period=str(req.period) if req.period else None)
    protocol_id, status = await client.SendPu3(req.model_dump())
    report_id = protocol_id
    await db.execute(
        text(
            """
            INSERT INTO fszn_reports (id, tenant_id, report_type, period, xml_data, status, protocol_id, sent_at)
            VALUES (:id, :tenant_id, :report_type, :period, :xml_data, :status, :protocol_id, CURRENT_TIMESTAMP)
            """
        ),
        {
            "id": report_id,
            "tenant_id": current_user.organization_id,
            "report_type": "pu3",
            "period": req.period,
            "xml_data": req.xml_data,
            "status": status,
            "protocol_id": protocol_id,
        },
    )
    await safe_log_audit(
        db=db,
        user_id=str(current_user.id),
        action="fszn_send_pu3",
        entity_type="fszn_report",
        entity_id=report_id,
        metadata={"status": status},
    )
    log.info("fszn_pu3_completed", protocol_id=protocol_id, status=status, user_id=str(current_user.id))
    return FsznResponse(protocol_id=protocol_id, status=status)


@router.post(
    "/salary/calculate",
    response_model=SalaryCalculationDTO,
    summary="Calculate salary for period",
    description="Calculates payroll for selected employee and period, persists `salary_calculations` row.",
    responses={404: {"description": "Employee not found"}},
)
async def calculate_salary(
    req: SalaryCalculationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calculate salary and persist salary_calculations row."""
    calculator = SalaryCalculator(db)
    log.info("salary_calculation_requested", employee_id=req.employee_id, user_id=str(current_user.id))
    try:
        result = await calculator.CalculateSalary(
            current_user.organization_id,
            req.employee_id,
            req.period_start,
            req.period_end,
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Employee not found")
    await safe_log_audit(
        db=db,
        user_id=str(current_user.id),
        action="salary_calculate",
        entity_type="salary_calculation",
        entity_id=result["id"],
        metadata={"employee_id": req.employee_id},
    )
    log.info("salary_calculation_completed", calculation_id=result["id"], employee_id=req.employee_id)
    return SalaryCalculationDTO(**result)


@router.get(
    "/salary/calculations",
    response_model=list[SalaryCalculationDTO],
    summary="List salary calculations",
    description="Returns salary calculations scoped to current tenant, newest first.",
)
async def list_salary_calculations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return salary calculations for current tenant."""
    rows = await db.execute(
        text(
            """
            SELECT sc.id, sc.employee_id, sc.period, sc.base_salary, sc.bonuses, sc.deductions, sc.taxes, sc.net_salary, sc.status
            FROM salary_calculations sc
            JOIN employees e ON e.id = sc.employee_id
            WHERE e.organization_id = :tenant_id
            ORDER BY sc.period DESC, sc.created_at DESC
            """
        ),
        {"tenant_id": current_user.organization_id},
    )
    result: list[SalaryCalculationDTO] = []
    for row in rows.mappings().all():
        result.append(
            SalaryCalculationDTO(
                id=row["id"],
                employee_id=row["employee_id"],
                period=row["period"],
                base_salary=row["base_salary"],
                bonuses=row["bonuses"],
                deductions=row["deductions"],
                taxes=row["taxes"],
                net_salary=row["net_salary"],
                status=row["status"],
            )
        )
    return result
