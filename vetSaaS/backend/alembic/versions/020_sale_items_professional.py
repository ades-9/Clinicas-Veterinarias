"""professional_user_id on sale_items + reports.view_general/view_own permissions check

Revision ID: 020
Revises: 019
Create Date: 2026-05-11
"""

from typing import Sequence, Union
from alembic import op

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE sale_items "
        "ADD COLUMN professional_user_id UUID REFERENCES users(id)"
    )
    op.execute(
        "CREATE INDEX sale_items_professional_idx ON sale_items(professional_user_id) "
        "WHERE professional_user_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS sale_items_professional_idx")
    op.execute("ALTER TABLE sale_items DROP COLUMN IF EXISTS professional_user_id")
