from datetime import date, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import CalendarEvent
from app.models.planner import PlannerTask


async def create_workforce_followup_task(
    db: AsyncSession,
    *,
    organization_id: str,
    author_user_id: str,
    assignee_user_id: str,
    title: str,
    description: str,
) -> PlannerTask:
    task = PlannerTask(
        tenant_id=organization_id,
        author_id=author_user_id,
        assignee_id=assignee_user_id,
        title=title,
        description=description,
        attachments=[],
        status="open",
    )
    db.add(task)
    await db.flush()
    return task


async def create_workforce_calendar_event(
    db: AsyncSession,
    *,
    organization_id: str,
    title: str,
    description: str,
    event_date: date,
    event_type: str = "deadline",
    color: str = "#0D9488",
) -> CalendarEvent:
    ev = CalendarEvent(
        organization_id=organization_id,
        title=title,
        description=description,
        event_date=event_date,
        event_type=event_type,
        color=color,
        is_auto=True,
        remind_days_before=3,
        is_recurring=False,
        recurrence_rule=None,
    )
    db.add(ev)
    await db.flush()
    return ev


def payroll_followup_date(base: date | None = None) -> date:
    dt = base or datetime.now(timezone.utc).date()
    return dt + timedelta(days=5)
