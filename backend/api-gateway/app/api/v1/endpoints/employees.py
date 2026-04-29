import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import date

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User
from app.models.employee import Employee, SalaryRecord
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    IdentityDocumentOut,
    IdentityDocumentPayload,
    SalaryCalculateRequest,
    SalaryResponse,
)
from app.services.tax_calculator import calculate_salary
from app.internal.audit.service import safe_log_audit
from app.internal.crypto.encrypt import get_aes_gcm_encryptor
from app.security import get_encryptor

router = APIRouter(
    prefix="/employees",
    tags=["employees"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)


def _id_doc_to_json(p: IdentityDocumentPayload) -> str:
    return json.dumps(
        {
            "series": p.series,
            "number": p.number,
            "issued_by": p.issued_by,
            "issued_date": p.issued_date.isoformat(),
            "expiry_date": p.expiry_date.isoformat() if p.expiry_date else None,
        },
        ensure_ascii=False,
    )


def _decrypt_id_document(enc, raw_enc: str | None) -> IdentityDocumentOut | None:
    if not raw_enc:
        return None
    try:
        raw = enc.decrypt(raw_enc)
        d = json.loads(raw)
        return IdentityDocumentOut(
            series=d.get("series"),
            number=str(d.get("number", "")),
            issued_by=str(d.get("issued_by", "")),
            issued_date=date.fromisoformat(str(d["issued_date"])[:10]),
            expiry_date=date.fromisoformat(str(d["expiry_date"])[:10]) if d.get("expiry_date") else None,
        )
    except Exception:
        return None


def _safe_decrypt(enc, raw_value: str | None) -> str | None:
    if not raw_value:
        return None
    try:
        return enc.decrypt(raw_value)
    except Exception:
        return None


def _employee_to_response(enc, pii_enc, e: Employee) -> EmployeeResponse:
    id_num = None
    if e.identification_number_enc:
        try:
            id_num = enc.decrypt(e.identification_number_enc)
        except Exception:
            id_num = None
    id_doc = _decrypt_id_document(enc, e.id_document_payload_enc)
    passport_data = _safe_decrypt(pii_enc, e.passport_data)
    phone = _safe_decrypt(pii_enc, e.phone)
    email = _safe_decrypt(pii_enc, e.email)
    address = _safe_decrypt(pii_enc, e.address)
    return EmployeeResponse(
        id=e.id,
        full_name=enc.decrypt(e.full_name_enc),
        identification_number=id_num,
        position=e.position,
        salary=e.salary,
        hire_date=e.hire_date,
        fire_date=e.fire_date,
        is_active=e.is_active,
        has_children=e.has_children,
        disability_group=e.disability_group,
        is_pensioner=e.is_pensioner,
        citizenship=e.citizenship,
        work_hours_per_day=e.work_hours_per_day,
        work_hours_per_week=e.work_hours_per_week,
        id_document_type=e.id_document_type,
        id_document=id_doc,
        passport_data=passport_data,
        phone=phone,
        email=email,
        address=address,
        created_at=e.created_at,
    )


@router.get("", response_model=list[EmployeeResponse])
async def list_employees(
    active_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enc = get_encryptor()
    pii_enc = get_aes_gcm_encryptor()
    filters = [Employee.organization_id == current_user.organization_id]
    if active_only:
        filters.append(Employee.is_active == True)

    result = await db.execute(
        select(Employee).where(and_(*filters)).order_by(Employee.hire_date)
    )
    employees = result.scalars().all()

    return [_employee_to_response(enc, pii_enc, e) for e in employees]


@router.post("", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    body: EmployeeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enc = get_encryptor()
    pii_enc = get_aes_gcm_encryptor()
    id_num_enc = enc.encrypt(body.identification_number) if body.identification_number else None
    id_doc_enc = None
    if body.id_document and body.id_document_type:
        id_doc_enc = enc.encrypt(_id_doc_to_json(body.id_document))
    emp = Employee(
        organization_id=current_user.organization_id,
        full_name_enc=enc.encrypt(body.full_name),
        identification_number_enc=id_num_enc,
        position=body.position,
        salary=body.salary,
        hire_date=body.hire_date,
        has_children=body.has_children,
        disability_group=body.disability_group,
        is_pensioner=body.is_pensioner,
        citizenship=body.citizenship,
        work_hours_per_day=body.work_hours_per_day,
        work_hours_per_week=body.work_hours_per_week,
        id_document_type=body.id_document_type,
        id_document_payload_enc=id_doc_enc,
        passport_data=pii_enc.encrypt(body.passport_data) if body.passport_data else None,
        phone=pii_enc.encrypt(body.phone) if body.phone else None,
        email=pii_enc.encrypt(str(body.email)) if body.email else None,
        address=pii_enc.encrypt(body.address) if body.address else None,
    )
    db.add(emp)
    await db.flush()

    await safe_log_audit(
        db,
        str(current_user.id),
        "employee_hire",
        "employee",
        str(emp.id),
    )
    return _employee_to_response(enc, pii_enc, emp)


@router.put("/{emp_id}", response_model=EmployeeResponse)
async def update_employee(
    emp_id: str,
    body: EmployeeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enc = get_encryptor()
    pii_enc = get_aes_gcm_encryptor()
    result = await db.execute(
        select(Employee).where(
            Employee.id == emp_id,
            Employee.organization_id == current_user.organization_id,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    patch = body.model_dump(exclude_unset=True)
    if body.position is not None:
        emp.position = body.position
    if body.salary is not None:
        emp.salary = body.salary
    if body.identification_number is not None:
        emp.identification_number_enc = enc.encrypt(body.identification_number)
    if body.has_children is not None:
        emp.has_children = body.has_children
    if "disability_group" in patch:
        emp.disability_group = body.disability_group
    if "is_pensioner" in patch:
        emp.is_pensioner = bool(body.is_pensioner)
    if "citizenship" in patch:
        emp.citizenship = body.citizenship.strip() if body.citizenship else None
    if "work_hours_per_day" in patch:
        emp.work_hours_per_day = body.work_hours_per_day
    if "work_hours_per_week" in patch:
        emp.work_hours_per_week = body.work_hours_per_week
    if "id_document_type" in patch or "id_document" in patch:
        if body.id_document_type and body.id_document:
            emp.id_document_type = body.id_document_type
            emp.id_document_payload_enc = enc.encrypt(_id_doc_to_json(body.id_document))
        elif not body.id_document_type and not body.id_document:
            emp.id_document_type = None
            emp.id_document_payload_enc = None
        else:
            raise HTTPException(
                status_code=400,
                detail="Укажите вид документа и все реквизиты или очистите оба поля",
            )
    if body.fire_date is not None:
        emp.fire_date = body.fire_date
        emp.is_active = False

    await db.flush()
    await safe_log_audit(db, str(current_user.id), "employee_update", "employee", str(emp.id))

    return _employee_to_response(enc, pii_enc, emp)


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
    await db.flush()
    await safe_log_audit(db, str(current_user.id), "employee_terminate", "employee", str(emp.id))


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
        is_disabled=emp.disability_group is not None,
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
    await safe_log_audit(
        db,
        str(current_user.id),
        "salary_calculate",
        "salary_record",
        str(record.id),
        metadata={
            "employee_id": body.employee_id,
            "period_year": body.period_year,
            "period_month": body.period_month,
        },
    )
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
