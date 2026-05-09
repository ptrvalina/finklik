"""Планирование отложенных напоминаний по событиям календаря."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

import structlog
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.datetime_utils import utc_now_naive
from app.models.calendar_reminder import CalendarReminderDelivery
from app.models.employee import CalendarEvent
from app.models.user import User

log = structlog.get_logger(__name__)

# Единое время срабатывания напоминания (UTC naive).
_REMINDER_SEND_TIME_UTC = time(7, 0)


def compute_reminder_fire_at(event: CalendarEvent) -> datetime:
    days = max(0, int(event.remind_days_before))
    reminder_day: date = event.event_date - timedelta(days=days)
    return datetime.combine(reminder_day, _REMINDER_SEND_TIME_UTC)


async def delete_pending_for_event(db: AsyncSession, event_id: str) -> None:
    await db.execute(
        delete(CalendarReminderDelivery).where(
            CalendarReminderDelivery.event_id == event_id,
            CalendarReminderDelivery.status == "pending",
        )
    )


def telegram_target_chat_for_user(user: User) -> str | None:
    if user.telegram_chat_id and str(user.telegram_chat_id).strip():
        return str(user.telegram_chat_id).strip()
    if settings.TELEGRAM_DEFAULT_CHAT_ID and settings.TELEGRAM_DEFAULT_CHAT_ID.strip():
        return settings.TELEGRAM_DEFAULT_CHAT_ID.strip()
    return None


async def sync_calendar_deliveries(db: AsyncSession, event: CalendarEvent) -> None:
    """Пересоздаёт pending-записи по текущим флагам события."""
    await delete_pending_for_event(db, event.id)
    if not event.created_by_user_id or event.is_completed:
        return
    result = await db.execute(select(User).where(User.id == event.created_by_user_id))
    user = result.scalar_one_or_none()
    if not user:
        log.warning("calendar_reminder.no_user", event_id=event.id)
        return

    fire_at = compute_reminder_fire_at(event)

    if event.remind_email and user.email:
        db.add(
            CalendarReminderDelivery(
                event_id=event.id,
                user_id=user.id,
                channel="email",
                fire_at=fire_at,
                status="pending",
            )
        )
    if event.remind_telegram and telegram_target_chat_for_user(user):
        db.add(
            CalendarReminderDelivery(
                event_id=event.id,
                user_id=user.id,
                channel="telegram",
                fire_at=fire_at,
                status="pending",
            )
        )
    await db.flush()
