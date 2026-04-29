"""Stage-3 workforce endpoints: employees, FSZN, salary."""

from __future__ import annotations

from datetime import date
import uuid

from fastapi import APIRouter, Depends, HTTPException
import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

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
from app.services.workforce_automation import (
    create_workforce_calendar_event,
    create_workforce_followup_task,
    payroll_followup_date,
)

router = APIRouter(
    tags=["workforce"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
    responses={401: {"description": "Unauthorized"}, 403: {"description": "Forbidden"}},
)
log = structlog.get_logger()


class PayrollRunRequest(BaseModel):
    period_year: int = Field(ge=2020, le=2100)
    period_month: int = Field(ge=1, le=12)
    work_days_plan: int = Field(default=21, ge=1, le=31)


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
    await create_workforce_followup_task(
        db=db,
        organization_id=str(current_user.organization_id),
        author_user_id=str(current_user.id),
        assignee_user_id=str(current_user.id),
        title="Оффбординг сотрудника",
        description=f"Проверьте кадровое закрытие сотрудника {employee_id} и подготовку ПУ-2/ПУ-3.",
    )
    await create_workforce_calendar_event(
        db=db,
        organization_id=str(current_user.organization_id),
        title="Контроль оффбординга сотрудника",
        description=f"Автоматическое событие после увольнения сотрудника {employee_id}.",
        event_date=req.termination_date,
        event_type="deadline",
        color="#C026D3",
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
    await create_workforce_followup_task(
        db=db,
        organization_id=str(current_user.organization_id),
        author_user_id=str(current_user.id),
        assignee_user_id=str(current_user.id),
        title="Проверка payroll-расчёта",
        description=f"Проверьте расчёт для сотрудника {req.employee_id} и подготовьте формы в ФСЗН.",
    )
    await create_workforce_calendar_event(
        db=db,
        organization_id=str(current_user.organization_id),
        title="Дедлайн payroll проверки",
        description=f"Автоматическое событие после расчёта зарплаты для сотрудника {req.employee_id}.",
        event_date=payroll_followup_date(),
        event_type="salary",
        color="#059669",
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


@router.post("/salary/run-month")
async def run_month_payroll(
    req: PayrollRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    calculator = SalaryCalculator(db)
    active_rows = await db.execute(
        text(
            """
            SELECT id
            FROM employees
            WHERE organization_id = :tenant_id
              AND is_active = 1
            """
        ),
        {"tenant_id": current_user.organization_id},
    )
    employee_ids = [str(r["id"]) for r in active_rows.mappings().all()]
    created = 0
    updated = 0
    errors: list[dict] = []

    for employee_id in employee_ids:
        existing = await db.execute(
            text(
                """
                SELECT id
                FROM salary_records
                WHERE organization_id = :tenant_id
                  AND employee_id = :employee_id
                  AND period_year = :year
                  AND period_month = :month
                LIMIT 1
                """
            ),
            {
                "tenant_id": current_user.organization_id,
                "employee_id": employee_id,
                "year": req.period_year,
                "month": req.period_month,
            },
        )
        existing_row = existing.mappings().first()
        try:
            result = await calculator.CalculateSalary(
                current_user.organization_id,
                employee_id,
                date(req.period_year, req.period_month, 1),
                date(req.period_year, req.period_month, min(28, req.work_days_plan)),
            )
            if existing_row:
                await db.execute(
                    text(
                        """
                        UPDATE salary_records
                        SET gross_salary = :gross_salary,
                            net_salary = :net_salary,
                            income_tax = :income_tax,
                            fsszn_employee = :fsszn_employee,
                            fsszn_employer = :fsszn_employer,
                            status = 'draft'
                        WHERE id = :id
                        """
                    ),
                    {
                        "id": existing_row["id"],
                        "gross_salary": result.get("net_salary", 0) + result.get("taxes", 0),
                        "net_salary": result.get("net_salary", 0),
                        "income_tax": result.get("taxes", 0),
                        "fsszn_employee": 0,
                        "fsszn_employer": 0,
                    },
                )
                updated += 1
            else:
                created += 1
        except Exception as exc:
            errors.append({"employee_id": employee_id, "error": str(exc)})

    await db.execute(
        text(
            """
            INSERT INTO planner_tasks (id, tenant_id, author_id, assignee_id, title, description, attachments, status, created_at, closed_at)
            VALUES (:id, :tenant_id, :author_id, :assignee_id, :title, :description, :attachments, :status, CURRENT_TIMESTAMP, NULL)
            """
        ),
        {
            "id": str(uuid.uuid4()),
            "tenant_id": current_user.organization_id,
            "author_id": str(current_user.id),
            "assignee_id": str(current_user.id),
            "title": f"Payroll run {req.period_month:02d}.{req.period_year}",
            "description": "Автоматический monthly payroll-run завершён. Проверьте расчёты и отправьте регламентные формы.",
            "attachments": "[]",
            "status": "open",
        },
    )
    await safe_log_audit(
        db=db,
        user_id=str(current_user.id),
        action="salary_run_month",
        entity_type="payroll",
        entity_id=f"{req.period_year}-{req.period_month:02d}",
        metadata={"created": created, "updated": updated, "errors": len(errors)},
    )
    return {
        "period_year": req.period_year,
        "period_month": req.period_month,
        "employees_total": len(employee_ids),
        "created": created,
        "updated": updated,
        "errors": errors[:50],
    }
