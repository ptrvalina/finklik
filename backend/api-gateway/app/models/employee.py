import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Numeric, Boolean, DateTime, Date, ForeignKey, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)

    # Персональные данные (хранятся зашифрованными)
    full_name_enc: Mapped[str] = mapped_column(String(500), nullable=False)
    identification_number_enc: Mapped[str | None] = mapped_column(String(500), nullable=True)
    position: Mapped[str] = mapped_column(String(255), nullable=False)
    salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)  # Оклад BYN

    hire_date: Mapped[date] = mapped_column(Date, nullable=False)
    fire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Налоговые данные
    has_children: Mapped[int] = mapped_column(Integer, default=0)  # Кол-во детей (вычет)
    is_disabled: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    salaries: Mapped[list["SalaryRecord"]] = relationship("SalaryRecord", back_populates="employee")


class SalaryRecord(Base):
    """Начисленная зарплата за месяц."""
    __tablename__ = "salary_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False)
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False)

    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-12

    # Начисления
    base_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    bonus: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    sick_pay: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    vacation_pay: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))

    # Рабочие дни
    work_days_plan: Mapped[int] = mapped_column(Integer, default=21)
    work_days_fact: Mapped[int] = mapped_column(Integer, default=21)
    sick_days: Mapped[int] = mapped_column(Integer, default=0)
    vacation_days: Mapped[int] = mapped_column(Integer, default=0)

    # Удержания
    income_tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))   # НДФЛ 13%
    fsszn_employee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))  # 1%

    # Итог
    gross_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    net_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))  # К выдаче

    # Взносы нанимателя
    fsszn_employer: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))  # 34%

    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft/paid
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee", back_populates="salaries")


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    event_type: Mapped[str] = mapped_column(String(30), default="custom")
    # tax / report / salary / meeting / deadline / custom

    color: Mapped[str] = mapped_column(String(7), default="#2563EB")  # HEX
    is_auto: Mapped[bool] = mapped_column(Boolean, default=False)  # Авто или пользовательское
    remind_days_before: Mapped[int] = mapped_column(Integer, default=3)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    recurrence_rule: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # monthly / quarterly / yearly

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    """Журнал всех действий пользователей."""
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
