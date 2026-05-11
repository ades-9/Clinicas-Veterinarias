"""Add status column to sales (with pending/completed/cancelled) — default pending

Nota: la columna status fue eliminada en la migración 003 cuando se rehizo
la tabla sales. La recreamos acá con los 3 valores que necesitamos.

Revision ID: 016
Revises: 015
Create Date: 2026-05-10
"""

from typing import Sequence, Union
from alembic import op

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Crear la columna status si no existe (default 'completed' para no romper datos existentes)
    op.execute("""
        ALTER TABLE sales
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'completed'
    """)

    # 2. CHECK constraint con los 3 valores
    op.execute("ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check")
    op.execute("""
        ALTER TABLE sales
        ADD CONSTRAINT sales_status_check
          CHECK (status IN ('pending','completed','cancelled'))
    """)

    # 3. Cambiar default a 'pending' (las ventas nuevas nacen así)
    op.execute("ALTER TABLE sales ALTER COLUMN status SET DEFAULT 'pending'")


def downgrade() -> None:
    op.execute("ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check")
    op.execute("ALTER TABLE sales DROP COLUMN IF EXISTS status")
