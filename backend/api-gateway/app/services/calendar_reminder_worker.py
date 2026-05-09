"""Фоновая отправка напоминаний календаря."""

from __future__ import annotations

import asyncio

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.datetime_utils import utc_now_naive
from app.models.calendar_reminder import CalendarReminderDelivery
from app.models.employee import CalendarEvent
from app.models.user import User
from app.services.calendar_reminder_service import telegram_target_chat_for_user
from app.services.planner_notifications import send_planner_email, send_planner_telegram

log = structlog.get_logger(__name__)


async def process_calendar_reminders_once(session: AsyncSession, batch_size: int = 50) -> int:
    now = utc_now_naive()
    result = await session.execute(
        select(CalendarReminderDelivery)
        .where(
            CalendarReminderDelivery.status == "pending",
            CalendarReminderDelivery.fire_at <= now,
        )
        .limit(batch_size)
    )
    deliveries = result.scalars().all()
    touched = 0
    for d in deliveries:
        ev_r = await session.execute(select(CalendarEvent).where(CalendarEvent.id == d.event_id))
        ev = ev_r.scalar_one_or_none()
        if not ev or ev.is_completed:
            d.status = "cancelled"
            touched += 1
            continue

        user_r = await session.execute(select(User).where(User.id == d.user_id))
        user = user_r.scalar_one_or_none()
        if not user:
            d.status = "failed"
            d.error_message = "user_missing"
            touched += 1
            continue

        title = ev.title
        body_text = f"Напоминание календаря: «{title}» ({ev.event_date.isoformat()})."
        subject = "Напоминание календаря"
        try:
            if d.channel == "email":
                if not user.email:
                    d.status = "failed"
                    d.error_message = "no_email"
                else:
                    ok = await send_planner_email(user.email, subject, body_text)
                    if ok:
                        d.status = "sent"
                        d.sent_at = utc_now_naive()
                        d.error_message = None
                    else:
                        d.status = "failed"
                        d.error_message = "email_failed"
            elif d.channel == "telegram":
                chat = telegram_target_chat_for_user(user)
                if not chat:
                    d.status = "failed"
                    d.error_message = "no_telegram_destination"
                else:
                    ok = await send_planner_telegram(body_text, chat_id=chat)
                    if ok:
                        d.status = "sent"
                        d.sent_at = utc_now_naive()
                        d.error_message = None
                    else:
                        d.status = "failed"
                        d.error_message = "telegram_failed"
            else:
                d.status = "failed"
                d.error_message = "unknown_channel"
        except Exception as exc:
            d.status = "failed"
            d.error_message = str(exc)[:500]
        touched += 1
    if touched:
        await session.commit()
    return touched


async def process_calendar_reminders_forever() -> None:
    poll_idle = 60 if not settings.DEBUG else 30
    poll_busy = 2
    while True:
        async with AsyncSessionLocal() as session:
            try:
                n = await process_calendar_reminders_once(session)
            except Exception as exc:
                log.error("calendar_reminder.worker_tick_failed", error=str(exc))
                await session.rollback()
                n = 0
        await asyncio.sleep(poll_busy if n else poll_idle)
