"""Add promotion fields to appointment_services

Revision ID: 005
Revises: 004
Create Date: 2026-05-07
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "appointment_services",
        sa.Column("promo_price", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "appointment_services",
        sa.Column("promo_start", sa.Date, nullable=True),
    )
    op.add_column(
        "appointment_services",
        sa.Column("promo_end", sa.Date, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("appointment_services", "promo_end")
    op.drop_column("appointment_services", "promo_start")
    op.drop_column("appointment_services", "promo_price")
