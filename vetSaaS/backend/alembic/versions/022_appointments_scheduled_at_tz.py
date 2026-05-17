"""appointments.scheduled_at -> TIMESTAMPTZ

Los timestamps existentes se guardaron como `TIMESTAMP WITHOUT TIME ZONE`
con valores en hora local de Ecuador (America/Guayaquil, UTC-5). Al pasarlos
a `TIMESTAMPTZ` los reinterpretamos con esa zona para preservar el momento
real, y a partir de ahora el frontend envía todo en UTC.

Revision ID: 022
Revises: 021
Create Date: 2026-05-13
"""

from typing import Sequence, Union
from alembic import op

revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE appointments
        ALTER COLUMN scheduled_at TYPE TIMESTAMPTZ
        USING scheduled_at AT TIME ZONE 'America/Guayaquil'
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE appointments
        ALTER COLUMN scheduled_at TYPE TIMESTAMP
        USING scheduled_at AT TIME ZONE 'America/Guayaquil'
    """)
