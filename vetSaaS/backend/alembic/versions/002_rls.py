"""Row Level Security en todas las tablas con clinic_id

Revision ID: 002
Revises: 001
Create Date: 2026-04-27
"""

from typing import Sequence, Union

from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = [
    "clinic_modules", "roles", "users", "owners", "patients",
    "appointment_services", "appointments", "medical_records",
    "medical_record_attachments", "vaccinations", "reminders",
    "product_categories", "products", "stock_movements", "sales",
]


def upgrade() -> None:
    for table in RLS_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS clinic_isolation ON {table}")
        op.execute(
            f"CREATE POLICY clinic_isolation ON {table} "
            f"USING (clinic_id = current_setting('app.current_clinic_id', TRUE)::uuid)"
        )


def downgrade() -> None:
    for table in reversed(RLS_TABLES):
        op.execute(f"DROP POLICY IF EXISTS clinic_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
