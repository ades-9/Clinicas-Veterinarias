"""Multi-servicio por cita via tabla link

Revision ID: 015
Revises: 014
Create Date: 2026-05-10
"""

from typing import Sequence, Union
from alembic import op

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Tabla puente
    op.execute("""
        CREATE TABLE appointment_service_links (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
            service_id      UUID NOT NULL REFERENCES appointment_services(id),
            position        INT NOT NULL DEFAULT 0,
            UNIQUE (appointment_id, service_id)
        )
    """)
    op.execute(
        "CREATE INDEX appointment_service_links_appointment_idx "
        "ON appointment_service_links(appointment_id)"
    )

    # 2. Migrar datos existentes: cada appointment.service_id → una row en la link table
    op.execute("""
        INSERT INTO appointment_service_links (appointment_id, service_id, position)
        SELECT id, service_id, 0
        FROM appointments
        WHERE service_id IS NOT NULL AND deleted_at IS NULL
    """)

    # 3. Drop columna service_id de appointments (la fuente de verdad ahora es la link table)
    op.execute("ALTER TABLE appointments DROP COLUMN IF EXISTS service_id")


def downgrade() -> None:
    # Restaurar columna service_id (con la primera de las links)
    op.execute("ALTER TABLE appointments ADD COLUMN service_id UUID REFERENCES appointment_services(id)")
    op.execute("""
        UPDATE appointments a
        SET service_id = (
            SELECT service_id FROM appointment_service_links l
            WHERE l.appointment_id = a.id
            ORDER BY position, id
            LIMIT 1
        )
    """)
    op.execute("DROP TABLE IF EXISTS appointment_service_links")
