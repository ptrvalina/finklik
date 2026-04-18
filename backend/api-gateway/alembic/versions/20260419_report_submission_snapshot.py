"""Archive snapshot of report payload at portal submit time (sprint 11–12 slice, no external API)."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "submission_archive_snapshot"
down_revision: str | None = "sprint12_regulatory_reporting"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    names = insp.get_table_names()
    if "report_submissions" not in names:
        return
    cols = {c["name"] for c in insp.get_columns("report_submissions")}
    if "submission_snapshot_json" not in cols:
        op.add_column(
            "report_submissions",
            sa.Column("submission_snapshot_json", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    names = insp.get_table_names()
    if "report_submissions" not in names:
        return
    cols = {c["name"] for c in insp.get_columns("report_submissions")}
    if "submission_snapshot_json" in cols:
        op.drop_column("report_submissions", "submission_snapshot_json")
