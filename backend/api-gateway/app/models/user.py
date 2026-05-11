import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, Text, UniqueConstraint, Index, false
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.core.datetime_utils import utc_now_naive


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    unp: Mapped[str] = mapped_column(String(9), unique=True, nullable=False)
    legal_form: Mapped[str] = mapped_column(String(10), default="ip")  # ip / ooo
    tax_regime: Mapped[str] = mapped_column(String(20), default="usn_no_vat")  # usn_no_vat / usn_vat / osn_vat
    max_users: Mapped[int] = mapped_column(default=2)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    #: Порядковые номера кадровых приказов (приём / увольнение) в рамках организации.
    hr_hire_order_seq: Mapped[int] = mapped_column(Integer, default=0)
    hr_fire_order_seq: Mapped[int] = mapped_column(Integer, default=0)

    # BYOK ИИ: ключ провайдера (OpenAI-совместимый) в зашифрованном виде; не смешивается с другими организациями.
    llm_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_base_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    llm_model: Mapped[str | None] = mapped_column(String(128), nullable=True)

    #: Реквизиты для договоров / печатных форм (в т.ч. выгрузка для контрагентов).
    legal_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    ceo_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    users: Mapped[list["User"]] = relationship("User", back_populates="organization")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="organization")
    invitations: Mapped[list["Invitation"]] = relationship("Invitation", back_populates="organization")
    memberships: Mapped[list["UserOrganizationMembership"]] = relationship(
        "UserOrganizationMembership", back_populates="organization"
    )


class UserOrganizationMembership(Base):
    """Доступ пользователя к организации (мульти-клиенты / бухгалтеры)."""

    __tablename__ = "user_organization_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "organization_id", name="uq_user_org_membership"),
        Index("ix_membership_user", "user_id"),
        Index("ix_membership_org", "organization_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    #: Переопределение роли в рамках организации (если NULL — используется User.role).
    role_in_org: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive)

    user: Mapped["User"] = relationship("User", back_populates="organization_memberships")
    organization: Mapped["Organization"] = relationship("Organization", back_populates="memberships")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="owner")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    organization_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    #: Личный chat_id в Telegram (бот должен получить /start от пользователя).
    telegram_chat_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    organization: Mapped["Organization | None"] = relationship("Organization", back_populates="users")
    organization_memberships: Mapped[list["UserOrganizationMembership"]] = relationship(
        "UserOrganizationMembership",
        back_populates="user",
        foreign_keys="UserOrganizationMembership.user_id",
    )


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="accountant")
    invite_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    invited_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending / accepted / expired
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    organization: Mapped["Organization"] = relationship("Organization", back_populates="invitations")
