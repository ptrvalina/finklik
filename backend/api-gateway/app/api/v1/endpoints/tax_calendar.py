from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from decimal import Decimal
from datetime import date, datetime, timezone

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
    calculate_usn, calculate_vat, calculate_fsszn, generate_tax_calendar
)

tax_router = APIRouter(prefix="/tax", tags=["tax"])
calendar_router = APIRouter(prefix="/calendar", tags=["calendar"])


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
        with_vat=with_vat,
    )

    # НДС (если плательщик НДС)
    vat_sales, vat_purchases, vat_to_pay, vat_deadline = calculate_vat(
        sales_with_vat=income if with_vat else Decimal("0"),
        purchases_with_vat=expense if with_vat else Decimal("0"),
        period_end=period_end,
    )

    # ФСЗН (ФОТ из зарплатных записей)
    fot_q = await db.execute(
        select(func.coalesce(func.sum(SalaryRecord.gross_salary), 0)).where(
            SalaryRecord.organization_id == org_id,
            SalaryRecord.period_year == period_end.year,
        )
    )
    fot = Decimal(str(fot_q.scalar()))
    fsszn_employer, fsszn_employee, fsszn_deadline = calculate_fsszn(fot, period_end)

    total = usn.usn_to_pay + vat_to_pay + fsszn_employer

    return TaxCalculationResult(
        period_start=period_start,
        period_end=period_end,
        tax_regime="usn_3" if with_vat else "usn_5",
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
        fsszn_employer_rate=Decimal("34"),
        fsszn_employer_amount=fsszn_employer,
        fsszn_employee_amount=fsszn_employee,
        total_to_pay=total,
        deadline=usn.deadline,
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
