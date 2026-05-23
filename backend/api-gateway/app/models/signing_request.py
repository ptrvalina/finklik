"""ЭЦП: запросы на подпись (хэш на сервере, ключ и подпись только на клиенте)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.datetime_utils import utc_now_naive


class SigningRequest(Base):
    __tablename__ = "signing_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    document_kind: Mapped[str] = mapped_column(String(40), nullable=False)
    document_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    document_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    hash_algorithm: Mapped[str] = mapped_column(String(20), nullable=False, default="SHA-256")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    # pending | signed | expired | rejected

    signature_b64: Mapped[str | None] = mapped_column(Text, nullable=True)
    certificate_pem: Mapped[str | None] = mapped_column(Text, nullable=True)
    certificate_metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(512), nullable=True)


class SigningSession(Base):
    """Лёгкая телеметрия клиентского шага подписания (без секретов)."""

    __tablename__ = "signing_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id: Mapped[str] = mapped_column(String(36), ForeignKey("signing_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    client_metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
