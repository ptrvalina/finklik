"""Sprint 7: реестр контуров 1С (onec_contours)."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "sprint7_onec_contours"
down_revision: str | None = "sprint6_primary_docs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if "organizations" not in insp.get_table_names():
        return
    if "onec_contours" in insp.get_table_names():
        return

    op.create_table(
        "onec_contours",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contour_key", sa.String(64), nullable=False),
        sa.Column("external_tenant_id", sa.String(128), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default=sa.text("'pending_provisioning'")),
        sa.Column("last_health_at", sa.DateTime(), nullable=True),
        sa.Column("last_health_ok", sa.Boolean(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("organization_id", name="uq_onec_contours_org"),
        sa.UniqueConstraint("contour_key", name="uq_onec_contours_key"),
    )
    op.create_index("ix_onec_contours_organization_id", "onec_contours", ["organization_id"])


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if "onec_contours" in insp.get_table_names():
        op.drop_table("onec_contours")
