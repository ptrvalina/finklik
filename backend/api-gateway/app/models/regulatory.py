"""Models for regulatory updates monitoring and automated report submissions."""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class RegulatoryUpdate(Base):
    """Tracks law/form changes from ФСЗН, ИМНС, Белгосстрах, Белстат."""
    __tablename__ = "regulatory_updates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    authority: Mapped[str] = mapped_column(String(30), nullable=False)  # fsszn / imns / belgosstrakh / belstat
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # law_change / form_update / rate_change / deadline_change
    severity: Mapped[str] = mapped_column(String(20), default="info")  # info / warning / critical
    effective_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RegulatoryNotification(Base):
    """Per-organization read status of regulatory updates."""
    __tablename__ = "regulatory_notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    update_id: Mapped[str] = mapped_column(String(36), ForeignKey("regulatory_updates.id"), nullable=False)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ReportSubmission(Base):
    """Tracks automated report submission workflow with client confirmation."""
    __tablename__ = "report_submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    authority: Mapped[str] = mapped_column(String(30), nullable=False)  # fsszn / imns / belgosstrakh / belstat
    report_type: Mapped[str] = mapped_column(String(50), nullable=False)  # pu-3 / vat-declaration / income-tax / insurance
    report_period: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g. "2026-Q1"
    report_data_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Workflow: draft → pending_review → confirmed → submitted → accepted / rejected
    status: Mapped[str] = mapped_column(String(30), default="draft")
    confirmed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    submission_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
