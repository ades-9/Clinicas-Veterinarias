"""Patient clinical and identification fields

Revision ID: 007
Revises: 006
Create Date: 2026-05-08
"""

from typing import Sequence, Union
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE patients ADD COLUMN sex VARCHAR(10) CHECK (sex IN ('male','female'))")
    op.execute("ALTER TABLE patients ADD COLUMN is_sterilized BOOLEAN")
    op.execute("ALTER TABLE patients ADD COLUMN color VARCHAR(80)")
    op.execute("ALTER TABLE patients ADD COLUMN microchip_number VARCHAR(50)")
    op.execute("ALTER TABLE patients ADD COLUMN distinctive_marks TEXT")
    op.execute("ALTER TABLE patients ADD COLUMN allergies TEXT")
    op.execute("ALTER TABLE patients ADD COLUMN chronic_conditions TEXT")
    op.execute("ALTER TABLE patients ADD COLUMN temperament_notes TEXT")
    op.execute("ALTER TABLE patients ADD COLUMN lifestyle_notes TEXT")
    op.execute("ALTER TABLE patients ADD COLUMN grooming_preferences TEXT")


def downgrade() -> None:
    for col in [
        "grooming_preferences", "lifestyle_notes", "temperament_notes",
        "chronic_conditions", "allergies", "distinctive_marks",
        "microchip_number", "color", "is_sterilized", "sex",
    ]:
        op.execute(f"ALTER TABLE patients DROP COLUMN IF EXISTS {col}")
