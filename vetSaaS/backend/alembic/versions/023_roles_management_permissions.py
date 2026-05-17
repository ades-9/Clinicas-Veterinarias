"""Permisos para gestionar roles + asignación al rol admin existente

Agrega `roles.view` y `roles.edit_permissions` al catálogo de permisos, y los
asigna al rol `admin` de cada clínica para que el administrador pueda editar
permisos por rol desde la UI.

Revision ID: 023
Revises: 022
Create Date: 2026-05-13
"""

from typing import Sequence, Union
from alembic import op

revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = ["roles.view", "roles.edit_permissions"]


def upgrade() -> None:
    for action in NEW_PERMISSIONS:
        op.execute(
            f"INSERT INTO permissions (action) VALUES ('{action}') ON CONFLICT DO NOTHING"
        )

    # Asignar los nuevos permisos al rol admin de cada clínica
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.name = 'admin'
          AND p.action IN ('roles.view', 'roles.edit_permissions')
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM role_permissions
        WHERE permission_id IN (
            SELECT id FROM permissions
            WHERE action IN ('roles.view', 'roles.edit_permissions')
        )
    """)
    op.execute("""
        DELETE FROM permissions
        WHERE action IN ('roles.view', 'roles.edit_permissions')
    """)
