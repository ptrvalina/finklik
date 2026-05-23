"""Справочник ОКЭД РБ (виды экономической деятельности)."""

from sqlalchemy import Boolean, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class OkedReference(Base):
    __tablename__ = "oked_reference"
    __table_args__ = (
        Index("ix_oked_parent", "parent_code"),
        Index("ix_oked_level", "level"),
    )

    code: Mapped[str] = mapped_column(String(12), primary_key=True)
    name_ru: Mapped[str] = mapped_column(String(512), nullable=False)
    parent_code: Mapped[str | None] = mapped_column(String(12), nullable=True)
    level: Mapped[int] = mapped_column(default=0)
    search_aliases: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
