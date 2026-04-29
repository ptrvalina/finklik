"""Add user roles, planner, notifications and KUDiR extensions."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "planner_notifications_roles"
down_revision: str | None = "audit_log_metadata_jsonb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_table(insp, table: str) -> bool:
    return table in insp.get_table_names()


def _has_column(insp, table: str, column: str) -> bool:
    if not _has_table(insp, table):
        return False
    return column in {c["name"] for c in insp.get_columns(table)}


def _has_index(insp, table: str, index_name: str) -> bool:
    if not _has_table(insp, table):
        return False
    return index_name in {i["name"] for i in insp.get_indexes(table)}


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)

    if _has_table(insp, "users") and not _has_column(insp, "users", "role"):
        op.add_column("users", sa.Column("role", sa.String(length=20), nullable=False, server_default="admin"))
        op.execute(sa.text("UPDATE users SET role = 'admin' WHERE role IS NULL"))

    insp = inspect(conn)
    if _has_table(insp, "planner_tasks"):
        pass
    else:
        op.create_table(
            "planner_tasks",
            sa.Column("id", sa.String(36), primary_key=True, nullable=False),
            sa.Column("tenant_id", sa.String(36), nullable=False),
            sa.Column("author_id", sa.String(36), nullable=False),
            sa.Column("assignee_id", sa.String(36), nullable=False),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("attachments", sa.JSON(), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="open"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("closed_at", sa.DateTime(), nullable=True),
        )

    insp = inspect(conn)
    if not _has_table(insp, "planner_reports"):
        op.create_table(
            "planner_reports",
            sa.Column("id", sa.String(36), primary_key=True, nullable=False),
            sa.Column("task_id", sa.String(36), nullable=False),
            sa.Column("author_id", sa.String(36), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("attachments", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )

    insp = inspect(conn)
    if not _has_table(insp, "notifications"):
        op.create_table(
            "notifications",
            sa.Column("id", sa.String(36), primary_key=True, nullable=False),
            sa.Column("user_id", sa.String(36), nullable=False),
            sa.Column("type", sa.String(40), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )

    if _has_table(insp, "income_expense_records"):
        if not _has_column(insp, "income_expense_records", "source"):
            op.add_column(
                "income_expense_records",
                sa.Column("source", sa.String(length=20), nullable=False, server_default="manual"),
            )
        if not _has_column(insp, "income_expense_records", "ai_category_confidence"):
            op.add_column(
                "income_expense_records",
                sa.Column("ai_category_confidence", sa.Numeric(5, 4), nullable=True),
            )
        if not _has_column(insp, "income_expense_records", "receipt_image_url"):
            op.add_column(
                "income_expense_records",
                sa.Column("receipt_image_url", sa.Text(), nullable=True),
            )

    insp = inspect(conn)
    if _has_table(insp, "planner_tasks"):
        if not _has_index(insp, "planner_tasks", "ix_planner_tasks_tenant_id"):
            op.create_index("ix_planner_tasks_tenant_id", "planner_tasks", ["tenant_id"])
        if not _has_index(insp, "planner_tasks", "ix_planner_tasks_assignee_id"):
            op.create_index("ix_planner_tasks_assignee_id", "planner_tasks", ["assignee_id"])
        if not _has_index(insp, "planner_tasks", "ix_planner_tasks_author_id"):
            op.create_index("ix_planner_tasks_author_id", "planner_tasks", ["author_id"])

    if _has_table(insp, "planner_reports") and not _has_index(insp, "planner_reports", "ix_planner_reports_task_id"):
        op.create_index("ix_planner_reports_task_id", "planner_reports", ["task_id"])

    if _has_table(insp, "notifications"):
        if not _has_index(insp, "notifications", "ix_notifications_user_id"):
            op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
        if not _has_index(insp, "notifications", "ix_notifications_created_at"):
            op.create_index("ix_notifications_created_at", "notifications", ["created_at"])


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)

    if _has_table(insp, "notifications"):
        if _has_index(insp, "notifications", "ix_notifications_created_at"):
            op.drop_index("ix_notifications_created_at", table_name="notifications")
        if _has_index(insp, "notifications", "ix_notifications_user_id"):
            op.drop_index("ix_notifications_user_id", table_name="notifications")
        op.drop_table("notifications")

    if _has_table(insp, "planner_reports"):
        if _has_index(insp, "planner_reports", "ix_planner_reports_task_id"):
            op.drop_index("ix_planner_reports_task_id", table_name="planner_reports")
        op.drop_table("planner_reports")

    if _has_table(insp, "planner_tasks"):
        if _has_index(insp, "planner_tasks", "ix_planner_tasks_author_id"):
            op.drop_index("ix_planner_tasks_author_id", table_name="planner_tasks")
        if _has_index(insp, "planner_tasks", "ix_planner_tasks_assignee_id"):
            op.drop_index("ix_planner_tasks_assignee_id", table_name="planner_tasks")
        if _has_index(insp, "planner_tasks", "ix_planner_tasks_tenant_id"):
            op.drop_index("ix_planner_tasks_tenant_id", table_name="planner_tasks")
        op.drop_table("planner_tasks")

    if _has_table(insp, "income_expense_records"):
        if _has_column(insp, "income_expense_records", "receipt_image_url"):
            op.drop_column("income_expense_records", "receipt_image_url")
        if _has_column(insp, "income_expense_records", "ai_category_confidence"):
            op.drop_column("income_expense_records", "ai_category_confidence")
        if _has_column(insp, "income_expense_records", "source"):
            op.drop_column("income_expense_records", "source")
