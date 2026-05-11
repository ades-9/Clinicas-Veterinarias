"""is_medication flag in products + prescription_items table

Revision ID: 017
Revises: 016
Create Date: 2026-05-11
"""

from typing import Sequence, Union
from alembic import op

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Flag is_medication en products
    op.execute("""
        ALTER TABLE products
        ADD COLUMN is_medication BOOLEAN NOT NULL DEFAULT FALSE
    """)
    op.execute("CREATE INDEX products_is_medication_idx ON products(is_medication) WHERE is_medication = TRUE")

    # 2. Tabla prescription_items — cada prescripción de un medical_record
    op.execute("""
        CREATE TABLE prescription_items (
            id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id          UUID NOT NULL REFERENCES clinics(id),
            medical_record_id  UUID NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
            product_id         UUID REFERENCES products(id),
            -- Si product_id es NULL, el vet escribió un medicamento custom no listado
            custom_name        VARCHAR(200),
            dose               VARCHAR(100),
            frequency          VARCHAR(100),
            duration           VARCHAR(100),
            notes              TEXT,
            created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at         TIMESTAMP,
            CHECK (product_id IS NOT NULL OR custom_name IS NOT NULL)
        )
    """)
    op.execute(
        "CREATE INDEX prescription_items_record_idx ON prescription_items(medical_record_id)"
    )

    # RLS
    op.execute("ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE prescription_items FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS clinic_isolation ON prescription_items")
    op.execute(
        "CREATE POLICY clinic_isolation ON prescription_items "
        "USING (clinic_id = current_setting('app.current_clinic_id', TRUE)::uuid)"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS clinic_isolation ON prescription_items")
    op.execute("DROP TABLE IF EXISTS prescription_items CASCADE")
    op.execute("DROP INDEX IF EXISTS products_is_medication_idx")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS is_medication")
