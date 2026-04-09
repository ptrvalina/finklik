from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import date

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.employee import Employee, SalaryRecord
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    SalaryCalculateRequest, SalaryResponse,
)
from app.services.tax_calculator import calculate_salary
from app.security import get_encryptor, audit_log

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=list[EmployeeResponse])
async def list_employees(
    active_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enc = get_encryptor()
    filters = [Employee.organization_id == current_user.organization_id]
    if active_only:
        filters.append(Employee.is_active == True)

    result = await db.execute(
        select(Employee).where(and_(*filters)).order_by(Employee.hire_date)
    )
    employees = result.scalars().all()

    out = []
    for e in employees:
        id_num = None
        if e.identification_number_enc:
            try:
                id_num = enc.decrypt(e.identification_number_enc)
            except Exception:
                id_num = None
        d = {
            "id": e.id,
            "full_name": enc.decrypt(e.full_name_enc),
            "identification_number": id_num,
            "position": e.position,
            "salary": e.salary,
            "hire_date": e.hire_date,
            "fire_date": e.fire_date,
            "is_active": e.is_active,
            "has_children": e.has_children,
            "created_at": e.created_at,
        }
        out.append(EmployeeResponse(**d))
    return out


@router.post("", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    body: EmployeeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enc = get_encryptor()
    id_num_enc = enc.encrypt(body.identification_number) if body.identification_number else None
    emp = Employee(
        organization_id=current_user.organization_id,
        full_name_enc=enc.encrypt(body.full_name),
        identification_number_enc=id_num_enc,
        position=body.position,
        salary=body.salary,
        hire_date=body.hire_date,
        has_children=body.has_children,
        is_disabled=body.is_disabled,
    )
    db.add(emp)
    await db.flush()

    audit_log("create", current_user.id, "employee", emp.id, "internal")
    return EmployeeResponse(
        id=emp.id,
        full_name=body.full_name,
        identification_number=body.identification_number,
        position=emp.position,
        salary=emp.salary,
        hire_date=emp.hire_date,
        fire_date=emp.fire_date,
        is_active=emp.is_active,
        has_children=emp.has_children,
        created_at=emp.created_at,
    )


@router.put("/{emp_id}", response_model=EmployeeResponse)
async def update_employee(
    emp_id: str,
    body: EmployeeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enc = get_encryptor()
    result = await db.execute(
        select(Employee).where(
            Employee.id == emp_id,
            Employee.organization_id == current_user.organization_id,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    if body.position is not None:
        emp.position = body.position
    if body.salary is not None:
        emp.salary = body.salary
    if body.identification_number is not None:
        emp.identification_number_enc = enc.encrypt(body.identification_number)
    if body.has_children is not None:
        emp.has_children = body.has_children
    if body.is_disabled is not None:
        emp.is_disabled = body.is_disabled
    if body.fire_date is not None:
        emp.fire_date = body.fire_date
        emp.is_active = False

    await db.flush()
    audit_log("update", current_user.id, "employee", emp.id, "internal")

    id_num = None
    if emp.identification_number_enc:
        try:
            id_num = enc.decrypt(emp.identification_number_enc)
        except Exception:
            pass
    return EmployeeResponse(
        id=emp.id,
        full_name=enc.decrypt(emp.full_name_enc),
        identification_number=id_num,
        position=emp.position,
        salary=emp.salary,
        hire_date=emp.hire_date,
        fire_date=emp.fire_date,
        is_active=emp.is_active,
        has_children=emp.has_children,
        created_at=emp.created_at,
    )


@router.delete("/{emp_id}", status_code=204)
async def fire_employee(
    emp_id: str,
    fire_date: date = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Employee).where(
            Employee.id == emp_id,
            Employee.organization_id == current_user.organization_id,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    emp.is_active = False
    emp.fire_date = fire_date or date.today()
    audit_log("fire", current_user.id, "employee", emp.id, "internal")


@router.post("/salary/calculate", response_model=SalaryResponse)
async def calculate_employee_salary(
    body: SalaryCalculateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Employee).where(
            Employee.id == body.employee_id,
            Employee.organization_id == current_user.organization_id,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    calc = calculate_salary(
        base_salary=emp.salary,
        bonus=body.bonus,
        sick_days=body.sick_days,
        vacation_days=body.vacation_days,
        work_days_plan=body.work_days_plan,
        has_children=emp.has_children,
        is_disabled=emp.is_disabled,
    )

    # Проверяем нет ли уже записи за этот период
    existing = await db.execute(
        select(SalaryRecord).where(
            SalaryRecord.employee_id == body.employee_id,
            SalaryRecord.period_year == body.period_year,
            SalaryRecord.period_month == body.period_month,
        )
    )
    record = existing.scalar_one_or_none()

    if record:
        # Обновляем
        for k, v in calc.items():
            setattr(record, k, v)
        record.status = "draft"
    else:
        # Создаём новую запись
        record = SalaryRecord(
            organization_id=current_user.organization_id,
            employee_id=body.employee_id,
            period_year=body.period_year,
            period_month=body.period_month,
            **calc,
        )
        db.add(record)

    await db.flush()
    return record


@router.get("/salary/list", response_model=list[SalaryResponse])
async def list_salary_records(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SalaryRecord).where(
            SalaryRecord.organization_id == current_user.organization_id,
            SalaryRecord.period_year == year,
            SalaryRecord.period_month == month,
        )
    )
    return result.scalars().all()
