"""Add 'promotional' to service_type CHECK constraints

Revision ID: 006
Revises: 005
Create Date: 2026-05-08
"""

from typing import Sequence, Union
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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


def downgrade() -> None:
    op.execute("""
        ALTER TABLE appointment_services
          DROP CONSTRAINT IF EXISTS appointment_services_service_type_check,
          ADD CONSTRAINT appointment_services_service_type_check
            CHECK (service_type IN ('veterinary','grooming'))
    """)
    op.execute("""
        ALTER TABLE appointments
          DROP CONSTRAINT IF EXISTS appointments_service_type_check,
          ADD CONSTRAINT appointments_service_type_check
            CHECK (service_type IN ('veterinary','grooming'))
    """)
