import io
import json
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import date

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, workspace_organization_id
from app.models.user import User, Organization
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
from app.services.workforce_automation import (
    create_workforce_calendar_event,
    create_workforce_followup_task,
    payroll_followup_date,
)
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
    hr_meta: dict | None = None
    if getattr(e, "hr_meta_json", None):
        try:
            hr_meta = json.loads(e.hr_meta_json)
        except json.JSONDecodeError:
            hr_meta = None
    return EmployeeResponse(
        id=e.id,
        full_name=enc.decrypt(e.full_name_enc),
        identification_number=id_num,
        position=e.position,
        position_code=e.position_code,
        position_name=e.position_name,
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
        hr_meta=hr_meta,
        created_at=e.created_at,
    )


@router.get("", response_model=list[EmployeeResponse])
async def list_employees(
    active_only: bool = Query(True),
    inactive_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enc = get_encryptor()
    pii_enc = get_aes_gcm_encryptor()
    filters = [Employee.organization_id == workspace_organization_id(current_user)]
    if inactive_only:
        filters.append(Employee.is_active == False)
    elif active_only:
        filters.append(Employee.is_active == True)

    result = await db.execute(
        select(Employee).where(and_(*filters)).order_by(Employee.hire_date)
    )
    employees = result.scalars().all()

    return [_employee_to_response(enc, pii_enc, e) for e in employees]


@router.get("/hr/sequences")
async def hr_order_sequences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Следующие порядковые номера приказов (после инкремента при сохранении)."""
    if not workspace_organization_id(current_user):
        raise HTTPException(400, detail="Нет организации")
    org_r = await db.execute(select(Organization).where(Organization.id == workspace_organization_id(current_user)))
    org = org_r.scalar_one_or_none()
    if not org:
        raise HTTPException(404, detail="Организация не найдена")
    h = org.hr_hire_order_seq or 0
    f = org.hr_fire_order_seq or 0
    return {
        "hire_next_index": h + 1,
        "fire_next_index": f + 1,
        "hire_next_label": f"Приказ о приёме № {h + 1}",
        "fire_next_label": f"Приказ об увольнении № {f + 1}",
    }


@router.get("/{emp_id}/salary-records", response_model=list[SalaryResponse])
async def employee_salary_records_range(
    emp_id: str,
    year_from: int = Query(..., ge=2000, le=2100),
    month_from: int = Query(..., ge=1, le=12),
    year_to: int = Query(..., ge=2000, le=2100),
    month_to: int = Query(..., ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Выписка из расчётной ведомости (salary_records) по сотруднику за период."""
    er = await db.execute(
        select(Employee).where(
            Employee.id == emp_id,
            Employee.organization_id == workspace_organization_id(current_user),
        )
    )
    if er.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    from_key = year_from * 12 + month_from
    to_key = year_to * 12 + month_to
    if from_key > to_key:
        raise HTTPException(status_code=400, detail="Неверный диапазон периодов")

    period_expr = SalaryRecord.period_year * 12 + SalaryRecord.period_month
    result = await db.execute(
        select(SalaryRecord)
        .where(
            SalaryRecord.organization_id == workspace_organization_id(current_user),
            SalaryRecord.employee_id == emp_id,
            period_expr >= from_key,
            period_expr <= to_key,
        )
        .order_by(SalaryRecord.period_year, SalaryRecord.period_month)
    )
    return result.scalars().all()


@router.get("/{emp_id}/documents/order-hire")
async def download_hire_order_document(
    emp_id: str,
    city: str = Query("", max_length=200),
    director_initials: str = Query("", max_length=200),
    employee_initials: str = Query("", max_length=200),
    application_number: str | None = Query(None, max_length=80),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """DOCX приказ о приёме по шаблону `resources/hr_templates/order_hire.docx`."""
    from app.services.hr_order_docx import build_hire_order_mapping, render_hire_order_docx

    enc = get_encryptor()
    er = await db.execute(
        select(Employee).where(
            Employee.id == emp_id,
            Employee.organization_id == workspace_organization_id(current_user),
        )
    )
    emp = er.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    org_r = await db.execute(select(Organization).where(Organization.id == workspace_organization_id(current_user)))
    org = org_r.scalar_one_or_none()
    org_name = (org.name if org else "") or ""

    meta: dict = {}
    if getattr(emp, "hr_meta_json", None):
        try:
            meta = json.loads(emp.hr_meta_json)
        except json.JSONDecodeError:
            meta = {}

    full_name = enc.decrypt(emp.full_name_enc)
    position_title = (emp.position_name or emp.position or "").strip()

    mapping = build_hire_order_mapping(
        organization_short_name=org_name,
        employee_full_name=full_name,
        position_title=position_title,
        hire_date=emp.hire_date,
        hr_meta=meta,
        city=city,
        director_initials=director_initials,
        employee_initials=employee_initials or None,
        application_number=application_number,
    )
    try:
        raw = render_hire_order_docx(mapping)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))

    fn = f"prikaz_o_prieme_{emp_id[:8]}.docx"
    cd = f"attachment; filename=\"{fn}\"; filename*=UTF-8''{quote(fn)}"
    return StreamingResponse(
        io.BytesIO(raw),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": cd},
    )


@router.get("/{emp_id}", response_model=EmployeeResponse)
async def get_employee(
    emp_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enc = get_encryptor()
    pii_enc = get_aes_gcm_encryptor()
    result = await db.execute(
        select(Employee).where(
            Employee.id == emp_id,
            Employee.organization_id == workspace_organization_id(current_user),
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    return _employee_to_response(enc, pii_enc, emp)


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
    org_r = await db.execute(select(Organization).where(Organization.id == workspace_organization_id(current_user)))
    org = org_r.scalar_one_or_none()
    if not org:
        raise HTTPException(400, detail="Организация не найдена")

    meta_dict: dict = {}
    if body.hr:
        meta_dict = body.hr.model_dump(exclude_none=True)
    org.hr_hire_order_seq = (org.hr_hire_order_seq or 0) + 1
    auto_seq = org.hr_hire_order_seq
    if not meta_dict.get("hire_order_number"):
        meta_dict["hire_order_number"] = str(auto_seq)
    meta_dict["hire_order_seq_auto"] = str(auto_seq)

    children = body.has_children
    if body.hr and body.hr.dependents_children is not None:
        children = max(children, body.hr.dependents_children)

    pos_name = body.position_name or body.position
    pos_code = body.position_code

    emp = Employee(
        organization_id=workspace_organization_id(current_user),
        full_name_enc=enc.encrypt(body.full_name),
        identification_number_enc=id_num_enc,
        position=body.position,
        position_code=pos_code,
        position_name=pos_name,
        salary=body.salary,
        hire_date=body.hire_date,
        has_children=children,
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
        hr_meta_json=json.dumps(meta_dict, ensure_ascii=False, default=str),
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
    await create_workforce_followup_task(
        db=db,
        organization_id=workspace_organization_id(current_user),
        author_user_id=str(current_user.id),
        assignee_user_id=str(current_user.id),
        title=f"Онбординг сотрудника: {body.full_name}",
        description="Проверьте кадровые документы, ПУ-2 и стартовые настройки начислений.",
    )
    await create_workforce_calendar_event(
        db=db,
        organization_id=workspace_organization_id(current_user),
        title=f"Кадровый контроль: {body.full_name}",
        description="Автоматическое событие после приёма сотрудника.",
        event_date=body.hire_date,
        event_type="report",
        color="#0D9488",
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
            Employee.organization_id == workspace_organization_id(current_user),
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    patch = body.model_dump(exclude_unset=True)
    if body.full_name is not None:
        emp.full_name_enc = enc.encrypt(body.full_name)
    if body.position is not None:
        emp.position = body.position
    if body.position_code is not None:
        emp.position_code = body.position_code.strip() if body.position_code else None
    if body.position_name is not None:
        emp.position_name = body.position_name.strip() if body.position_name else None
    if body.salary is not None:
        emp.salary = body.salary
    if body.identification_number is not None:
        emp.identification_number_enc = (
            enc.encrypt(body.identification_number) if body.identification_number else None
        )
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
    if body.passport_data is not None:
        emp.passport_data = pii_enc.encrypt(body.passport_data) if body.passport_data.strip() else None
    if body.phone is not None:
        emp.phone = pii_enc.encrypt(body.phone.strip()) if body.phone.strip() else None
    if body.email is not None:
        emp.email = pii_enc.encrypt(str(body.email)) if body.email else None
    if body.address is not None:
        emp.address = pii_enc.encrypt(body.address.strip()) if body.address.strip() else None
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
    if body.hr_meta_patch is not None:
        meta: dict = {}
        if emp.hr_meta_json:
            try:
                meta = json.loads(emp.hr_meta_json)
            except json.JSONDecodeError:
                meta = {}
        meta.update(body.hr_meta_patch)
        emp.hr_meta_json = json.dumps(meta, ensure_ascii=False, default=str)
        if isinstance(body.hr_meta_patch.get("dependents_children"), int):
            emp.has_children = max(emp.has_children, body.hr_meta_patch["dependents_children"])
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
            Employee.organization_id == workspace_organization_id(current_user),
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    emp.is_active = False
    emp.fire_date = fire_date or date.today()
    fire_dt = emp.fire_date or date.today()
    await db.flush()
    await safe_log_audit(db, str(current_user.id), "employee_terminate", "employee", str(emp.id))
    full_name = _safe_decrypt(get_encryptor(), emp.full_name_enc) or "Сотрудник"
    await create_workforce_followup_task(
        db=db,
        organization_id=workspace_organization_id(current_user),
        author_user_id=str(current_user.id),
        assignee_user_id=str(current_user.id),
        title=f"Оффбординг сотрудника: {full_name}",
        description="Проверьте увольнение, расчёт и отправку кадровой отчётности.",
    )
    await create_workforce_calendar_event(
        db=db,
        organization_id=workspace_organization_id(current_user),
        title=f"Увольнение: {full_name}",
        description="Автоматическое событие контроля закрытия кадрового цикла.",
        event_date=fire_dt,
        event_type="deadline",
        color="#C026D3",
    )


@router.post("/salary/calculate", response_model=SalaryResponse)
async def calculate_employee_salary(
    body: SalaryCalculateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Employee).where(
            Employee.id == body.employee_id,
            Employee.organization_id == workspace_organization_id(current_user),
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
            organization_id=workspace_organization_id(current_user),
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
    await create_workforce_followup_task(
        db=db,
        organization_id=workspace_organization_id(current_user),
        author_user_id=str(current_user.id),
        assignee_user_id=str(current_user.id),
        title=f"Проверка начисления зарплаты ({body.period_month:02d}.{body.period_year})",
        description="Проверьте расчёт, после чего отправьте регламентные формы и закройте выплату.",
    )
    await create_workforce_calendar_event(
        db=db,
        organization_id=workspace_organization_id(current_user),
        title=f"Дедлайн payroll ({body.period_month:02d}.{body.period_year})",
        description="Автоматическое напоминание по payroll после расчёта.",
        event_date=payroll_followup_date(),
        event_type="salary",
        color="#059669",
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
            SalaryRecord.organization_id == workspace_organization_id(current_user),
            SalaryRecord.period_year == year,
            SalaryRecord.period_month == month,
        )
    )
    return result.scalars().all()
