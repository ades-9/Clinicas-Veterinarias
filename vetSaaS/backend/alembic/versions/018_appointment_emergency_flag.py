"""is_emergency flag in appointments

Revision ID: 018
Revises: 017
Create Date: 2026-05-11
"""

from typing import Sequence, Union
from alembic import op

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE appointments ADD COLUMN is_emergency BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute(
        "CREATE INDEX appointments_emergency_idx ON appointments(is_emergency) "
        "WHERE is_emergency = TRUE"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS appointments_emergency_idx")
    op.execute("ALTER TABLE appointments DROP COLUMN IF EXISTS is_emergency")
