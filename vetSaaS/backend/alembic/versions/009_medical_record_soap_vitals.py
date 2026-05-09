"""Medical record SOAP vitals: heart rate, respiratory rate, pulse, physical exam

Revision ID: 009
Revises: 008
Create Date: 2026-05-08
"""

from typing import Sequence, Union
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE medical_records ADD COLUMN heart_rate INT")
    op.execute("ALTER TABLE medical_records ADD COLUMN respiratory_rate INT")
    op.execute("ALTER TABLE medical_records ADD COLUMN pulse VARCHAR(50)")
    op.execute("ALTER TABLE medical_records ADD COLUMN physical_exam TEXT")


def downgrade() -> None:
    for col in ["physical_exam", "pulse", "respiratory_rate", "heart_rate"]:
        op.execute(f"ALTER TABLE medical_records DROP COLUMN IF EXISTS {col}")
