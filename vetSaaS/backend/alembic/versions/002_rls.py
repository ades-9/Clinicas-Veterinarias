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
    tables_array = ", ".join(f"'{t}'" for t in RLS_TABLES)
    op.execute(f"""
        DO $$
        DECLARE
            t text;
        BEGIN
            FOREACH t IN ARRAY ARRAY[{tables_array}]
            LOOP
                EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
                EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
                EXECUTE format('DROP POLICY IF EXISTS clinic_isolation ON %I', t);
                EXECUTE format(
                    'CREATE POLICY clinic_isolation ON %I '
                    'USING (clinic_id = current_setting(''app.current_clinic_id'', TRUE)::uuid)',
                    t
                );
            END LOOP;
        END
        $$
    """)


def downgrade() -> None:
    tables_array = ", ".join(f"'{t}'" for t in RLS_TABLES)
    op.execute(f"""
        DO $$
        DECLARE
            t text;
        BEGIN
            FOREACH t IN ARRAY ARRAY[{tables_array}]
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS clinic_isolation ON %I', t);
                EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
                EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
            END LOOP;
        END
        $$
    """)
