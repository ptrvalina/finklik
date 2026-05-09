"""PostgreSQL: DEFAULT CURRENT_TIMESTAMP для counterparties.created_at."""

from typing import Sequence

from alembic import op

revision: str = "cp_created_pg_default"
down_revision: str | None = "org_legal_cp_kind"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        op.execute(
            "ALTER TABLE counterparties ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP"
        )


def downgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        op.execute("ALTER TABLE counterparties ALTER COLUMN created_at DROP DEFAULT")
