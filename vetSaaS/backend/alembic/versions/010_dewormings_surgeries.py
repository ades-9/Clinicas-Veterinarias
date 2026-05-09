"""Dewormings and surgeries tables with RLS

Revision ID: 010
Revises: 009
Create Date: 2026-05-08
"""

from typing import Sequence, Union
from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE dewormings (
            id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id              UUID NOT NULL REFERENCES clinics(id),
            patient_id             UUID NOT NULL REFERENCES patients(id),
            medical_record_id      UUID REFERENCES medical_records(id),
            product_name           VARCHAR(150) NOT NULL,
            treatment_type         VARCHAR(20) NOT NULL
                                   CHECK (treatment_type IN ('internal','external','both')),
            applied_at             DATE NOT NULL,
            next_dose_at           DATE,
            weight_at_application  DECIMAL(5,2),
            batch_number           VARCHAR(50),
            notes                  TEXT,
            created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at             TIMESTAMP
        )
    """)

    op.execute("""
        CREATE TABLE surgeries (
            id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id          UUID NOT NULL REFERENCES clinics(id),
            patient_id         UUID NOT NULL REFERENCES patients(id),
            medical_record_id  UUID REFERENCES medical_records(id),
            name               VARCHAR(150) NOT NULL,
            performed_at       DATE NOT NULL,
            veterinarian_name  VARCHAR(150),
            description        TEXT,
            complications      TEXT,
            created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at         TIMESTAMP
        )
    """)

    # RLS por clinic_id, mismo patrón que migration 002
    for table in ("dewormings", "surgeries"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS clinic_isolation ON {table}")
        op.execute(
            f"CREATE POLICY clinic_isolation ON {table} "
            f"USING (clinic_id = current_setting('app.current_clinic_id', TRUE)::uuid)"
        )


def downgrade() -> None:
    for table in ("surgeries", "dewormings"):
        op.execute(f"DROP POLICY IF EXISTS clinic_isolation ON {table}")
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
