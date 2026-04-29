import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AutomationPolicy(Base):
    __tablename__ = "automation_policies"
    __table_args__ = (UniqueConstraint("organization_id", name="uq_automation_policy_org"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    mode: Mapped[str] = mapped_column(String(20), default="assist")  # assist/checkpoints/autopilot
    allow_auto_reporting: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_auto_workforce: Mapped[bool] = mapped_column(Boolean, default=False)
    max_auto_submissions_per_run: Mapped[int] = mapped_column(Integer, default=20)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
