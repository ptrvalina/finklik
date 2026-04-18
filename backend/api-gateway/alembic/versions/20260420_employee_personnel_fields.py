"""Сотрудники: группа инвалидности 1–3, документ удостоверения личности, гражданство, пенсионер, ставка (часы)."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text

revision: str = "employee_personnel_fields"
down_revision: str | None = "submission_archive_snapshot"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(insp, table: str, column: str) -> bool:
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if "employees" not in insp.get_table_names():
        return

    if not _has_column(insp, "employees", "disability_group"):
        op.add_column("employees", sa.Column("disability_group", sa.Integer(), nullable=True))
    if not _has_column(insp, "employees", "is_pensioner"):
        false_default = sa.false() if conn.dialect.name == "postgresql" else sa.text("0")
        op.add_column(
            "employees",
            sa.Column("is_pensioner", sa.Boolean(), nullable=False, server_default=false_default),
        )
    if not _has_column(insp, "employees", "citizenship"):
        op.add_column("employees", sa.Column("citizenship", sa.String(255), nullable=True))
    if not _has_column(insp, "employees", "work_hours_per_day"):
        op.add_column("employees", sa.Column("work_hours_per_day", sa.Numeric(5, 2), nullable=True))
    if not _has_column(insp, "employees", "work_hours_per_week"):
        op.add_column("employees", sa.Column("work_hours_per_week", sa.Numeric(6, 2), nullable=True))
    if not _has_column(insp, "employees", "id_document_type"):
        op.add_column("employees", sa.Column("id_document_type", sa.String(40), nullable=True))
    if not _has_column(insp, "employees", "id_document_payload_enc"):
        op.add_column("employees", sa.Column("id_document_payload_enc", sa.Text(), nullable=True))

    insp = inspect(conn)
    if _has_column(insp, "employees", "is_disabled"):
        if conn.dialect.name == "postgresql":
            op.execute(
                text(
                    "UPDATE employees SET disability_group = 3 "
                    "WHERE is_disabled IS TRUE AND disability_group IS NULL"
                )
            )
        else:
            # SQLite и др.: булево как 0/1
            op.execute(
                text(
                    "UPDATE employees SET disability_group = 3 "
                    "WHERE COALESCE(is_disabled, 0) != 0 AND disability_group IS NULL"
                )
            )
        op.drop_column("employees", "is_disabled")

    try:
        op.alter_column("employees", "is_pensioner", server_default=None)
    except Exception:
        pass


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if "employees" not in insp.get_table_names():
        return

    if not _has_column(insp, "employees", "is_disabled"):
        false_default = sa.false() if conn.dialect.name == "postgresql" else sa.text("0")
        op.add_column(
            "employees",
            sa.Column("is_disabled", sa.Boolean(), nullable=False, server_default=false_default),
        )
    if conn.dialect.name == "postgresql":
        op.execute(text("UPDATE employees SET is_disabled = TRUE WHERE disability_group IS NOT NULL"))
    else:
        op.execute(text("UPDATE employees SET is_disabled = 1 WHERE disability_group IS NOT NULL"))

    for col in (
        "id_document_payload_enc",
        "id_document_type",
        "work_hours_per_week",
        "work_hours_per_day",
        "citizenship",
        "is_pensioner",
        "disability_group",
    ):
        insp = inspect(conn)
        if _has_column(insp, "employees", col):
            op.drop_column("employees", col)
