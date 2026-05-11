"""Flow 10: идемпотентность доменных событий (защита от повторной доставки / replay)."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "flow10_evt_idempotency_v1"
down_revision: str | None = "flow7_state_audit_v1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "domain_events",
        sa.Column("idempotency_key", sa.String(128), nullable=True),
    )
    # PostgreSQL: NULL считаются различными в UNIQUE — старые строки с NULL не конфликтуют.
    op.create_index(
        "uq_domain_events_org_idempotency",
        "domain_events",
        ["organization_id", "idempotency_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_domain_events_org_idempotency", table_name="domain_events")
    op.drop_column("domain_events", "idempotency_key")
