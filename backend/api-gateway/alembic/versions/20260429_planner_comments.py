"""Add planner comments table."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "planner_comments"
down_revision: str | None = "bank_oauth2_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_table(insp, table: str) -> bool:
    return table in insp.get_table_names()


def _has_index(insp, table: str, index_name: str) -> bool:
    if not _has_table(insp, table):
        return False
    return index_name in {i["name"] for i in insp.get_indexes(table)}


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if not _has_table(insp, "planner_comments"):
        op.create_table(
            "planner_comments",
            sa.Column("id", sa.String(36), primary_key=True, nullable=False),
            sa.Column("task_id", sa.String(36), nullable=False),
            sa.Column("author_id", sa.String(36), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
    insp = inspect(conn)
    if _has_table(insp, "planner_comments") and not _has_index(insp, "planner_comments", "ix_planner_comments_task_id"):
        op.create_index("ix_planner_comments_task_id", "planner_comments", ["task_id"])


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if _has_table(insp, "planner_comments"):
        if _has_index(insp, "planner_comments", "ix_planner_comments_task_id"):
            op.drop_index("ix_planner_comments_task_id", table_name="planner_comments")
        op.drop_table("planner_comments")
