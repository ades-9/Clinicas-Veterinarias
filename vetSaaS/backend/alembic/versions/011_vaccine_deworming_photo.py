"""Photo URL for vaccine and deworming labels

Revision ID: 011
Revises: 010
Create Date: 2026-05-09
"""

from typing import Sequence, Union
from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE vaccinations ADD COLUMN photo_url TEXT")
    op.execute("ALTER TABLE dewormings ADD COLUMN photo_url TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE vaccinations DROP COLUMN IF EXISTS photo_url")
    op.execute("ALTER TABLE dewormings DROP COLUMN IF EXISTS photo_url")
