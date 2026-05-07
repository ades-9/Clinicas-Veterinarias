"""Products, stock and sales — Phase 3 (redesign)

Drops the placeholder tables from 001 and recreates them with the
full Phase-3 schema: price/cost/sku/unit/is_active on products,
movement_type on stock_movements, notes on sales, clinic_id on sale_items.

Revision ID: 003
Revises: 002
Create Date: 2026-05-07
"""

from typing import Sequence, Union

from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_TABLES = ["sale_items", "sales", "stock_movements", "products", "product_categories"]
_NEW_TABLES = ["product_categories", "products", "stock_movements", "sales", "sale_items"]


def upgrade() -> None:
    # Drop placeholder tables from 001 (FK order: children first)
    for t in _OLD_TABLES:
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE")

    op.execute("""
        CREATE TABLE product_categories (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id   UUID NOT NULL REFERENCES clinics(id),
            name        VARCHAR(100) NOT NULL,
            created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at  TIMESTAMP
        )
    """)

    op.execute("""
        CREATE TABLE products (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id       UUID NOT NULL REFERENCES clinics(id),
            category_id     UUID REFERENCES product_categories(id),
            name            VARCHAR(150) NOT NULL,
            description     TEXT,
            sku             VARCHAR(50),
            unit            VARCHAR(30) NOT NULL DEFAULT 'unidad',
            price           NUMERIC(12,2) NOT NULL DEFAULT 0,
            cost            NUMERIC(12,2),
            stock           NUMERIC(12,2) NOT NULL DEFAULT 0,
            min_stock       NUMERIC(12,2) NOT NULL DEFAULT 0,
            is_active       BOOLEAN NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at      TIMESTAMP
        )
    """)

    op.execute("""
        CREATE TABLE stock_movements (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id       UUID NOT NULL REFERENCES clinics(id),
            product_id      UUID NOT NULL REFERENCES products(id),
            user_id         UUID REFERENCES users(id),
            movement_type   VARCHAR(20) NOT NULL
                            CHECK (movement_type IN ('entry','exit','adjustment')),
            quantity        NUMERIC(12,2) NOT NULL,
            reason          TEXT,
            created_at      TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("""
        CREATE TABLE sales (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id   UUID NOT NULL REFERENCES clinics(id),
            user_id     UUID REFERENCES users(id),
            patient_id  UUID REFERENCES patients(id),
            owner_id    UUID REFERENCES owners(id),
            total       NUMERIC(12,2) NOT NULL DEFAULT 0,
            notes       TEXT,
            created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at  TIMESTAMP
        )
    """)

    op.execute("""
        CREATE TABLE sale_items (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id   UUID NOT NULL REFERENCES clinics(id),
            sale_id     UUID NOT NULL REFERENCES sales(id),
            product_id  UUID NOT NULL REFERENCES products(id),
            quantity    NUMERIC(12,2) NOT NULL,
            unit_price  NUMERIC(12,2) NOT NULL,
            subtotal    NUMERIC(12,2) NOT NULL
        )
    """)

    # RLS for all new tables
    for table in _NEW_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY clinic_isolation ON {table}
            USING (clinic_id = current_setting('app.current_clinic_id')::uuid)
        """)


def downgrade() -> None:
    for t in reversed(_NEW_TABLES):
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
