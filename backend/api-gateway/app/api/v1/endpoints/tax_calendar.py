from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from decimal import Decimal
from datetime import date, datetime, timezone
from pathlib import Path
import structlog
from prometheus_client import Counter

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, Organization
from app.models.transaction import Transaction
from app.models.employee import CalendarEvent, SalaryRecord
from app.schemas.employee import (
    TaxCalculationResult,
    CalendarEventCreate, CalendarEventUpdate, CalendarEventResponse,
)
from app.services.tax_calculator import (
    calculate_usn, calculate_vat, calculate_fsszn, generate_tax_calendar, get_tax_rules_for_year, validate_tax_rules_config
)

tax_router = APIRouter(prefix="/tax", tags=["tax"])
calendar_router = APIRouter(prefix="/calendar", tags=["calendar"])
log = structlog.get_logger(__name__)

tax_rules_fallback_counter = Counter(
    "tax_rules_validate_fallback_total",
    "Number of tax rules validation requests that used fallback values.",
    ["cause"],
)


# ── Налоговые эндпоинты ───────────────────────────────────────────────────────

@tax_router.get("/calculate", response_model=TaxCalculationResult)
async def calculate_taxes(
    period_start: date = Query(...),
    period_end: date = Query(...),
    with_vat: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id
    org = None
    if org_id:
        org_r = await db.execute(select(Organization).where(Organization.id == org_id))
        org = org_r.scalar_one_or_none()

    org_regime = (org.tax_regime if org else "usn_no_vat").strip().lower()
    allowed_regimes = {"usn_no_vat", "usn_vat", "osn_vat"}
    if org_regime not in allowed_regimes:
        org_regime = "usn_no_vat"

    warnings: list[str] = []
    if org_regime == "usn_no_vat":
        with_vat_effective = False
        if with_vat:
            warnings.append("Параметр with_vat=true проигнорирован: режим организации usn_no_vat.")
    elif org_regime == "usn_vat":
        with_vat_effective = True
        if not with_vat:
            warnings.append("НДС включён по режиму usn_vat, even if with_vat=false.")
    else:  # osn_vat
        with_vat_effective = True
        if not with_vat:
            warnings.append("НДС включён по режиму osn_vat, even if with_vat=false.")

    regime_code = "usn_3" if with_vat_effective else "usn_5"
    rules = get_tax_rules_for_year(period_end.year)

    # Доходы за период
    income_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.organization_id == org_id,
                Transaction.type == "income",
                Transaction.transaction_date >= period_start,
                Transaction.transaction_date <= period_end,
            )
        )
    )
    income = Decimal(str(income_q.scalar()))

    # Расходы за период
    expense_q = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.organization_id == org_id,
                Transaction.type == "expense",
                Transaction.transaction_date >= period_start,
                Transaction.transaction_date <= period_end,
            )
        )
    )
    expense = Decimal(str(expense_q.scalar()))

    # УСН
    usn = calculate_usn(
        income=income,
        period_start=period_start,
        period_end=period_end,
        with_vat=with_vat_effective,
        usn_rate_with_vat=rules.usn_rate_with_vat,
        usn_rate_without_vat=rules.usn_rate_without_vat,
    )

    # НДС (если плательщик НДС)
    vat_sales, vat_purchases, vat_to_pay, vat_deadline = calculate_vat(
        sales_with_vat=income if with_vat_effective else Decimal("0"),
        purchases_with_vat=expense if with_vat_effective else Decimal("0"),
        period_end=period_end,
        vat_rate=rules.vat_rate,
    )

    # ФСЗН (ФОТ из зарплатных записей)
    fot_q = await db.execute(
        select(func.coalesce(func.sum(SalaryRecord.gross_salary), 0)).where(
            SalaryRecord.organization_id == org_id,
            SalaryRecord.period_year == period_end.year,
        )
    )
    fot = Decimal(str(fot_q.scalar()))
    fsszn_employer, fsszn_employee, fsszn_deadline = calculate_fsszn(
        fot,
        period_end,
        fsszn_employer_rate=rules.fsszn_employer,
        fsszn_employee_rate=rules.fsszn_employee,
    )

    total = usn.usn_to_pay + vat_to_pay + fsszn_employer
    assumptions = [
        f"Режим организации: {org_regime}",
        f"Нормативная версия: {rules.version} ({rules.year})",
        f"НДС включён в расчёт: {'да' if with_vat_effective else 'нет'}",
        "База УСН: все доходы за выбранный период.",
        "ФСЗН: 34% наниматель и 1% удержание из зарплаты.",
    ] + warnings
    breakdown = [
        f"Доходы: {income} BYN",
        f"Расходы: {expense} BYN",
        f"УСН ({usn.usn_rate}%): {usn.usn_to_pay} BYN",
        f"НДС к уплате: {vat_to_pay} BYN",
        f"ФСЗН нанимателя: {fsszn_employer} BYN",
        f"Итого: {total} BYN",
    ]

    return TaxCalculationResult(
        period_start=period_start,
        period_end=period_end,
        tax_regime=regime_code,
        income=income,
        expense=expense,
        tax_base=income,
        usn_rate=usn.usn_rate,
        usn_amount=usn.usn_amount,
        usn_paid=usn.usn_paid,
        usn_to_pay=usn.usn_to_pay,
        vat_sales=vat_sales,
        vat_purchases=vat_purchases,
        vat_to_pay=vat_to_pay,
        fsszn_fot=fot,
        fsszn_employer_rate=rules.fsszn_employer * 100,
        fsszn_employer_amount=fsszn_employer,
        fsszn_employee_amount=fsszn_employee,
        total_to_pay=total,
        deadline=usn.deadline,
        vat_deadline=vat_deadline if with_vat_effective else None,
        fsszn_deadline=fsszn_deadline,
        assumptions=assumptions,
        breakdown=breakdown,
        regulatory_version=rules.version,
        regulatory_year=rules.year,
    )


@tax_router.get("/calendar")
async def get_tax_calendar(
    year: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org = None
    if current_user.organization_id:
        result = await db.execute(select(Organization).where(Organization.id == current_user.organization_id))
        org = result.scalar_one_or_none()
    tax_regime = org.tax_regime if org else "usn_no_vat"
    legal_form = org.legal_form if org else "ip"
    events = generate_tax_calendar(year, tax_regime=tax_regime, legal_form=legal_form)
    return {"year": year, "tax_regime": tax_regime, "legal_form": legal_form, "events": events, "total": len(events)}


@tax_router.get("/rules/validate")
async def validate_tax_rules(
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Только owner может валидировать налоговые правила")
    payload = validate_tax_rules_config()
    if payload.get("using_fallback"):
        cause = "missing" if payload.get("ok") else "error"
        tax_rules_fallback_counter.labels(cause=cause).inc()
        log.warning(
            "tax_rules_validation_fallback",
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            cause=cause,
            source=payload.get("source"),
            first_error=(payload.get("errors") or [None])[0],
            path=Path(str(payload.get("path", ""))).name,
        )
    return payload


# ── Календарные эндпоинты ─────────────────────────────────────────────────────

@calendar_router.get("/events", response_model=list[CalendarEventResponse])
async def list_events(
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CalendarEvent).where(
            and_(
                CalendarEvent.organization_id == current_user.organization_id,
                CalendarEvent.event_date >= date_from,
                CalendarEvent.event_date <= date_to,
            )
        ).order_by(CalendarEvent.event_date)
    )
    return result.scalars().all()


@calendar_router.post("/events", response_model=CalendarEventResponse, status_code=201)
async def create_event(
    body: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = CalendarEvent(
        organization_id=current_user.organization_id,
        title=body.title,
        description=body.description,
        event_date=body.event_date,
        event_type=body.event_type,
        color=body.color,
        is_auto=False,
        remind_days_before=body.remind_days_before,
        is_recurring=body.is_recurring,
        recurrence_rule=body.recurrence_rule,
    )
    db.add(event)
    await db.flush()
    return event


@calendar_router.put("/events/{event_id}", response_model=CalendarEventResponse)
async def update_event(
    event_id: str,
    body: CalendarEventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.organization_id == current_user.organization_id,
            CalendarEvent.is_auto == False,
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")

    if body.title is not None:
        event.title = body.title
    if body.description is not None:
        event.description = body.description
    if body.event_date is not None:
        event.event_date = body.event_date
    if body.color is not None:
        event.color = body.color
    if body.remind_days_before is not None:
        event.remind_days_before = body.remind_days_before

    await db.flush()
    return event


@calendar_router.delete("/events/{event_id}", status_code=204)
async def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.organization_id == current_user.organization_id,
            CalendarEvent.is_auto == False,
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено или нельзя удалить")
    await db.delete(event)
