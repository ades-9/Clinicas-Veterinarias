"""Replace 'promotional' service_type with is_promotional flag; add 'aesthetic' area; users.areas

Revision ID: 014
Revises: 013
Create Date: 2026-05-10
"""

from typing import Sequence, Union
from alembic import op

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Flag is_promotional en appointment_services (por defecto FALSE)
    op.execute("""
        ALTER TABLE appointment_services
        ADD COLUMN is_promotional BOOLEAN NOT NULL DEFAULT FALSE
    """)

    # 2. Migrar datos: lo que era 'promotional' pasa a 'veterinary' + is_promotional=TRUE
    op.execute("""
        UPDATE appointment_services
        SET service_type = 'veterinary', is_promotional = TRUE
        WHERE service_type = 'promotional'
    """)
    op.execute("""
        UPDATE appointments
        SET service_type = 'veterinary'
        WHERE service_type = 'promotional'
    """)

    # 3. Reemplazar CHECK constraints: agregar 'aesthetic', quitar 'promotional'
    op.execute("""
        ALTER TABLE appointment_services
          DROP CONSTRAINT IF EXISTS appointment_services_service_type_check,
          ADD CONSTRAINT appointment_services_service_type_check
            CHECK (service_type IN ('veterinary','grooming','aesthetic'))
    """)
    op.execute("""
        ALTER TABLE appointments
          DROP CONSTRAINT IF EXISTS appointments_service_type_check,
          ADD CONSTRAINT appointments_service_type_check
            CHECK (service_type IN ('veterinary','grooming','aesthetic'))
    """)

    # 4. users.areas: array de áreas en las que el profesional puede trabajar.
    #    Vacío = sin restricción (puede trabajar en todas).
    op.execute("""
        ALTER TABLE users
        ADD COLUMN areas TEXT[] NOT NULL DEFAULT '{}'
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS areas")

    # Volver promotional al CHECK
    op.execute("""
        UPDATE appointment_services
        SET service_type = 'promotional'
        WHERE is_promotional = TRUE
    """)
    op.execute("""
        ALTER TABLE appointment_services
          DROP CONSTRAINT IF EXISTS appointment_services_service_type_check,
          ADD CONSTRAINT appointment_services_service_type_check
            CHECK (service_type IN ('veterinary','grooming','promotional'))
    """)
    op.execute("""
        ALTER TABLE appointments
          DROP CONSTRAINT IF EXISTS appointments_service_type_check,
          ADD CONSTRAINT appointments_service_type_check
            CHECK (service_type IN ('veterinary','grooming','promotional'))
    """)

    op.execute("ALTER TABLE appointment_services DROP COLUMN IF EXISTS is_promotional")
