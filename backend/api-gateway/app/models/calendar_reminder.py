import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.datetime_utils import utc_now_naive


class CalendarReminderDelivery(Base):
    """Отложенная доставка напоминания по событию календаря (email / Telegram)."""

    __tablename__ = "calendar_reminder_deliveries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("calendar_events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    #: email | telegram
    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    #: UTC naive — см. datetime_utils.
    fire_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    #: pending | sent | failed | cancelled
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: utc_now_naive())

    event = relationship("CalendarEvent", back_populates="reminder_deliveries")
    user = relationship("User")
