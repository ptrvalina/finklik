from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from decimal import Decimal
from datetime import date, datetime, time as dt_time, timezone
from pathlib import Path
import structlog
from prometheus_client import Counter

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, Organization
from app.models.transaction import Transaction
from app.models.employee import CalendarEvent, SalaryRecord
from app.models.planner import PlannerTask
from app.schemas.employee import (
    TaxCalculationResult,
    CalendarEventCompleteBody,
    CalendarEventCreate,
    CalendarEventUpdate,
    CalendarEventResponse,
    CalendarProductivitySummary,
)
from app.services.calendar_reminder_service import delete_pending_for_event, sync_calendar_deliveries
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


async def _sync_auto_calendar_obligations(
    db: AsyncSession,
    organization_id: str,
    year: int,
    tax_regime: str,
    legal_form: str,
) -> int:
    generated = generate_tax_calendar(year, tax_regime=tax_regime, legal_form=legal_form)
    existing_result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.organization_id == organization_id,
            CalendarEvent.is_auto == True,  # noqa: E712
            CalendarEvent.event_date >= date(year, 1, 1),
            CalendarEvent.event_date <= date(year, 12, 31),
        )
    )
    existing = existing_result.scalars().all()
    existing_keys = {(e.title, e.event_type, e.event_date.isoformat()): e for e in existing}
    touched: set[tuple[str, str, str]] = set()
    created = 0

    for item in generated:
        key = (str(item["title"]), str(item["event_type"]), str(item["event_date"]))
        touched.add(key)
        if key in existing_keys:
            ev = existing_keys[key]
            ev.color = str(item.get("color") or ev.color)
            ev.remind_days_before = 5
            continue
        db.add(
            CalendarEvent(
                organization_id=organization_id,
                title=str(item["title"]),
                description="Автоматически создано системой налоговых обязательств",
                event_date=date.fromisoformat(str(item["event_date"])),
                event_type=str(item["event_type"]),
                color=str(item.get("color") or "#D97706"),
                is_auto=True,
                remind_days_before=5,
                is_recurring=False,
                recurrence_rule=None,
            )
        )
        created += 1

    for ev in existing:
        key = (ev.title, ev.event_type, ev.event_date.isoformat())
        if key not in touched:
            await db.delete(ev)

    await db.flush()
    return created


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

    regime_code = "usn_6_vat" if with_vat_effective else "usn_6_no_vat"
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
        "Ставки НДС по законодательству: 0%, 10%, 20%; в модели используется vat_rate из конфига.",
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
    if current_user.organization_id:
        await _sync_auto_calendar_obligations(
            db=db,
            organization_id=current_user.organization_id,
            year=year,
            tax_regime=tax_regime,
            legal_form=legal_form,
        )
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
        all_day=body.all_day,
        time_start=body.time_start,
        time_end=body.time_end,
        remind_email=body.remind_email,
        remind_telegram=body.remind_telegram,
        created_by_user_id=str(current_user.id),
    )
    db.add(event)
    await db.flush()
    await sync_calendar_deliveries(db, event)
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

    patch = body.model_dump(exclude_unset=True)
    for key in ("title", "description", "event_date", "color", "remind_days_before", "all_day", "time_start", "time_end", "remind_email", "remind_telegram"):
        if key in patch:
            setattr(event, key, patch[key])

    await db.flush()
    await sync_calendar_deliveries(db, event)
    return event


@calendar_router.post("/events/{event_id}/complete", response_model=CalendarEventResponse)
async def complete_calendar_event(
    event_id: str,
    body: CalendarEventCompleteBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.organization_id == current_user.organization_id,
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    if body.done:
        event.is_completed = True
        event.completed_at = datetime.now(timezone.utc)
        await delete_pending_for_event(db, event.id)
    else:
        event.is_completed = False
        event.completed_at = None
        await sync_calendar_deliveries(db, event)
    await db.flush()
    return event


@calendar_router.get("/productivity-summary", response_model=CalendarProductivitySummary)
async def calendar_productivity_summary(
    period_start: date = Query(...),
    period_end: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if period_end < period_start:
        raise HTTPException(status_code=400, detail="Неверный период")
    org_id = current_user.organization_id
    if not org_id:
        raise HTTPException(status_code=400, detail="Нет организации")

    start_dt = datetime.combine(period_start, dt_time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(period_end, dt_time(23, 59, 59), tzinfo=timezone.utc)

    ce_completed_r = await db.execute(
        select(func.count()).select_from(CalendarEvent).where(
            CalendarEvent.organization_id == org_id,
            CalendarEvent.is_completed.is_(True),
            CalendarEvent.completed_at.isnot(None),
            CalendarEvent.completed_at >= start_dt,
            CalendarEvent.completed_at <= end_dt,
        )
    )
    ce_completed = int(ce_completed_r.scalar_one() or 0)

    pt_completed_r = await db.execute(
        select(func.count()).select_from(PlannerTask).where(
            PlannerTask.tenant_id == str(org_id),
            PlannerTask.status == "closed",
            PlannerTask.closed_at.isnot(None),
            PlannerTask.closed_at >= start_dt,
            PlannerTask.closed_at <= end_dt,
        )
    )
    pt_completed = int(pt_completed_r.scalar_one() or 0)

    ce_total_r = await db.execute(
        select(func.count()).select_from(CalendarEvent).where(
            CalendarEvent.organization_id == org_id,
            CalendarEvent.event_date >= period_start,
            CalendarEvent.event_date <= period_end,
        )
    )
    ce_total = int(ce_total_r.scalar_one() or 0)

    pt_created_r = await db.execute(
        select(func.count()).select_from(PlannerTask).where(
            PlannerTask.tenant_id == str(org_id),
            PlannerTask.created_at >= start_dt,
            PlannerTask.created_at <= end_dt,
        )
    )
    pt_created = int(pt_created_r.scalar_one() or 0)

    open_tasks_r = await db.execute(
        select(func.count()).select_from(PlannerTask).where(
            PlannerTask.tenant_id == str(org_id),
            PlannerTask.status != "closed",
        )
    )
    open_tasks = int(open_tasks_r.scalar_one() or 0)

    denom = ce_total + pt_created
    done = ce_completed + pt_completed
    ratio = round(done / max(1, denom), 3)

    return CalendarProductivitySummary(
        period_start=period_start,
        period_end=period_end,
        completed_calendar_events=ce_completed,
        completed_planner_tasks=pt_completed,
        total_calendar_events_in_period=ce_total,
        open_planner_tasks_at_end=open_tasks,
        productivity_ratio=ratio,
    )


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
