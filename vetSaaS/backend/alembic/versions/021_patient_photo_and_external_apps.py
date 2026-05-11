"""patients.photo_url + applied_externally fields on vaccinations/dewormings/surgeries

Revision ID: 021
Revises: 020
Create Date: 2026-05-11
"""

from typing import Sequence, Union
from alembic import op

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Foto de la mascota
    op.execute("ALTER TABLE patients ADD COLUMN photo_url TEXT")

    # Marcar aplicaciones hechas en otra clínica
    op.execute(
        "ALTER TABLE vaccinations "
        "ADD COLUMN applied_externally BOOLEAN NOT NULL DEFAULT FALSE, "
        "ADD COLUMN external_clinic_name VARCHAR(150)"
    )
    op.execute(
        "ALTER TABLE dewormings "
        "ADD COLUMN applied_externally BOOLEAN NOT NULL DEFAULT FALSE, "
        "ADD COLUMN external_clinic_name VARCHAR(150)"
    )
    op.execute(
        "ALTER TABLE surgeries "
        "ADD COLUMN applied_externally BOOLEAN NOT NULL DEFAULT FALSE, "
        "ADD COLUMN external_clinic_name VARCHAR(150)"
    )


def downgrade() -> None:
    for table in ("vaccinations", "dewormings", "surgeries"):
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS external_clinic_name")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS applied_externally")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS photo_url")
