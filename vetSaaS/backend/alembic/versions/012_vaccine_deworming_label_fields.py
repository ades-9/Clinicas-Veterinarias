"""Manufacturer / expiration / weight at application on vaccinations & dewormings

Revision ID: 012
Revises: 011
Create Date: 2026-05-09
"""

from typing import Sequence, Union
from alembic import op

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Vacunas
    op.execute("ALTER TABLE vaccinations ADD COLUMN manufacturer VARCHAR(150)")
    op.execute("ALTER TABLE vaccinations ADD COLUMN expiration_date DATE")
    op.execute("ALTER TABLE vaccinations ADD COLUMN weight_at_application DECIMAL(5,2)")

    # Desparasitaciones
    op.execute("ALTER TABLE dewormings ADD COLUMN manufacturer VARCHAR(150)")
    op.execute("ALTER TABLE dewormings ADD COLUMN expiration_date DATE")


def downgrade() -> None:
    for col in ("manufacturer", "expiration_date", "weight_at_application"):
        op.execute(f"ALTER TABLE vaccinations DROP COLUMN IF EXISTS {col}")
    for col in ("manufacturer", "expiration_date"):
        op.execute(f"ALTER TABLE dewormings DROP COLUMN IF EXISTS {col}")
