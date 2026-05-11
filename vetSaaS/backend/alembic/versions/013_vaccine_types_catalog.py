"""Vaccine types catalog + vaccine_type_id FK on vaccinations

Revision ID: 013
Revises: 012
Create Date: 2026-05-09
"""

from typing import Sequence, Union
from alembic import op

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Catálogo común en clínicas veterinarias de Latinoamérica.
# species_name = NULL ⇒ aplica a varias / no específica.
_VACCINE_TYPES = [
    # Caninos
    ("Rabia Canina",                      "Perro", 12),
    ("Quintuple Canina (DHPPi)",          "Perro", 12),
    ("Sextuple Canina (DHPPi+L)",         "Perro", 12),
    ("Octuple Canina",                    "Perro", 12),
    ("Bordetella (tos de las perreras)",  "Perro", 12),
    ("Leptospirosis",                     "Perro", 6),
    ("Giardia",                           "Perro", 12),

    # Felinos
    ("Rabia Felina",                      "Gato", 12),
    ("Triple Felina (FVRCP)",             "Gato", 12),
    ("Cuádruple Felina",                  "Gato", 12),
    ("Leucemia Felina (FeLV)",            "Gato", 12),

    # Conejos
    ("Mixomatosis",                       "Conejo", 12),
    ("Enfermedad Hemorrágica Viral",      "Conejo", 12),
]


def upgrade() -> None:
    op.execute("""
        CREATE TABLE vaccine_types (
            id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name                              VARCHAR(150) NOT NULL UNIQUE,
            species_id                        UUID REFERENCES species(id),
            description                       TEXT,
            recommended_revaccination_months  INT
        )
    """)

    for name, species_name, months in _VACCINE_TYPES:
        safe_name = name.replace("'", "''")
        op.execute(f"""
            INSERT INTO vaccine_types (name, species_id, recommended_revaccination_months)
            SELECT '{safe_name}', s.id, {months}
            FROM species s WHERE s.name = '{species_name}'
            ON CONFLICT (name) DO NOTHING
        """)

    op.execute("ALTER TABLE vaccinations ADD COLUMN vaccine_type_id UUID REFERENCES vaccine_types(id)")


def downgrade() -> None:
    op.execute("ALTER TABLE vaccinations DROP COLUMN IF EXISTS vaccine_type_id")
    op.execute("DROP TABLE IF EXISTS vaccine_types")
