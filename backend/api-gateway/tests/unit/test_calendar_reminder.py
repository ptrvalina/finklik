from datetime import date, datetime, time

from app.models.employee import CalendarEvent
from app.services.calendar_reminder_service import compute_reminder_fire_at


def test_compute_reminder_fire_at_simple():
    ev = CalendarEvent(
        organization_id="00000000-0000-0000-0000-000000000001",
        title="Срок УСН",
        event_date=date(2026, 5, 20),
        remind_days_before=5,
    )
    got = compute_reminder_fire_at(ev)
    assert got == datetime.combine(date(2026, 5, 15), time(7, 0))


def test_compute_reminder_fire_at_zero_days():
    ev = CalendarEvent(
        organization_id="00000000-0000-0000-0000-000000000001",
        title="Событие",
        event_date=date(2026, 6, 1),
        remind_days_before=0,
    )
    got = compute_reminder_fire_at(ev)
    assert got == datetime.combine(date(2026, 6, 1), time(7, 0))
