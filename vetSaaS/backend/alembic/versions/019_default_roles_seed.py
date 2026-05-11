"""Seed default roles (recepcionista, veterinario, groomer, esteticista) per clinic

Revision ID: 019
Revises: 018
Create Date: 2026-05-11
"""

from typing import Sequence, Union
from alembic import op

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Permisos por rol (deben existir en la tabla permissions desde la migración 001)
ROLE_PERMISSIONS = {
    "recepcionista": [
        "owners.view", "owners.create", "owners.edit",
        "patients.view", "patients.create", "patients.edit",
        "appointments.view_all", "appointments.create", "appointments.edit", "appointments.cancel",
        "medical_records.view",
        "products.view",
        "sales.view", "sales.create", "sales.cancel",
    ],
    "veterinario": [
        "owners.view",
        "patients.view", "patients.create", "patients.edit",
        "appointments.view_own", "appointments.edit",
        "medical_records.view", "medical_records.create", "medical_records.edit",
        "products.view",
        "sales.view", "sales.create",
        "reports.view_own",
    ],
    "groomer": [
        "owners.view",
        "patients.view",
        "appointments.view_own", "appointments.edit",
        "products.view",
        "sales.view",
    ],
    "esteticista": [
        "owners.view",
        "patients.view",
        "appointments.view_own", "appointments.edit",
        "products.view",
        "sales.view",
    ],
}


def upgrade() -> None:
    # Para cada clínica existente, crear los 4 roles si no existen + asignar permisos
    for role_name, perms in ROLE_PERMISSIONS.items():
        perms_array = "ARRAY[" + ",".join(f"'{p}'" for p in perms) + "]"
        op.execute(f"""
            DO $$
            DECLARE
                c_id UUID;
                r_id UUID;
            BEGIN
                FOR c_id IN SELECT id FROM clinics WHERE deleted_at IS NULL LOOP
                    -- Buscar si el rol ya existe
                    SELECT id INTO r_id FROM roles WHERE clinic_id = c_id AND name = '{role_name}';

                    IF r_id IS NULL THEN
                        INSERT INTO roles (clinic_id, name) VALUES (c_id, '{role_name}')
                        RETURNING id INTO r_id;

                        INSERT INTO role_permissions (role_id, permission_id)
                        SELECT r_id, p.id FROM permissions p
                        WHERE p.action = ANY ({perms_array}::varchar[]);
                    END IF;
                END LOOP;
            END
            $$;
        """)


def downgrade() -> None:
    # Borrar los roles default solo si no tienen usuarios asignados (seguro)
    for role_name in ROLE_PERMISSIONS.keys():
        op.execute(f"""
            DELETE FROM role_permissions
            WHERE role_id IN (
                SELECT r.id FROM roles r
                WHERE r.name = '{role_name}'
                  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.role_id = r.id AND u.deleted_at IS NULL)
            )
        """)
        op.execute(f"""
            DELETE FROM roles r
            WHERE r.name = '{role_name}'
              AND NOT EXISTS (SELECT 1 FROM users u WHERE u.role_id = r.id AND u.deleted_at IS NULL)
        """)
