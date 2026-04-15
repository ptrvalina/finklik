"""Sprint 9: payment_events timeline for invoice payments."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "sprint9_payment_events"
down_revision: str | None = "sprint7_onec_contours"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    names = insp.get_table_names()
    if "organizations" not in names:
        return
    if "payment_events" in names:
        return

    op.create_table(
        "payment_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("doc_id", sa.String(36), sa.ForeignKey("primary_documents.id"), nullable=False),
        sa.Column("event_type", sa.String(40), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default=sa.text("'system'")),
        sa.Column("payload_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_payment_events_organization_id", "payment_events", ["organization_id"])
    op.create_index("ix_payment_events_doc_id", "payment_events", ["doc_id"])
    op.create_index("ix_payment_events_doc_created", "payment_events", ["doc_id", "created_at"])
    op.create_index("ix_payment_events_org_created", "payment_events", ["organization_id", "created_at"])


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if "payment_events" in insp.get_table_names():
        op.drop_table("payment_events")
