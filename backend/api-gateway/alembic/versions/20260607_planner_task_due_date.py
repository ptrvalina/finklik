"""Add due_date to planner tasks."""

from alembic import op
import sqlalchemy as sa

revision: str = "planner_task_due_date_v1"
down_revision = "execution_trust_pilot_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("planner_tasks", sa.Column("due_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("planner_tasks", "due_date")
