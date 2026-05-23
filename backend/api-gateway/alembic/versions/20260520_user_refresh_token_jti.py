"""Refresh token rotation: хранение актуального jti для обнаружения повторного использования старого refresh."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "user_refresh_jti_v1"
down_revision: str | None = "flow10_evt_idempotency_v1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("refresh_token_jti", sa.String(36), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "refresh_token_jti")
