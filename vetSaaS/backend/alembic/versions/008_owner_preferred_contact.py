"""Owner preferred contact channel

Revision ID: 008
Revises: 007
Create Date: 2026-05-08
"""

from typing import Sequence, Union
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE owners
          ADD COLUMN preferred_contact VARCHAR(20)
          CHECK (preferred_contact IN ('whatsapp','sms','email','phone'))
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE owners DROP COLUMN IF EXISTS preferred_contact")
