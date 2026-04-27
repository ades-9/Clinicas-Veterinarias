"""Initial schema — all tables with RLS

Revision ID: 001
Revises:
Create Date: 2026-04-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------ #
    # clinics
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE clinics (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name        VARCHAR(150) NOT NULL,
            phone       VARCHAR(20),
            address     TEXT,
            email       VARCHAR(150),
            tax_id      VARCHAR(50),
            logo_url    TEXT,
            is_active   BOOLEAN NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at  TIMESTAMP
        )
    """)

    # ------------------------------------------------------------------ #
    # clinic_modules
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE clinic_modules (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id    UUID NOT NULL REFERENCES clinics(id),
            module       VARCHAR(50) NOT NULL
                         CHECK (module IN ('medical_records','appointments',
                                           'reminders','products','sales','reports')),
            is_active    BOOLEAN NOT NULL DEFAULT FALSE,
            activated_at TIMESTAMP,
            UNIQUE (clinic_id, module)
        )
    """)

    # ------------------------------------------------------------------ #
    # roles
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE roles (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id  UUID REFERENCES clinics(id),
            name       VARCHAR(50) NOT NULL
        )
    """)

    # ------------------------------------------------------------------ #
    # permissions
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE permissions (
            id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            action VARCHAR(100) NOT NULL UNIQUE
        )
    """)

    # ------------------------------------------------------------------ #
    # role_permissions
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE role_permissions (
            role_id       UUID NOT NULL REFERENCES roles(id),
            permission_id UUID NOT NULL REFERENCES permissions(id),
            PRIMARY KEY (role_id, permission_id)
        )
    """)

    # ------------------------------------------------------------------ #
    # users
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE users (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id      UUID NOT NULL REFERENCES clinics(id),
            role_id        UUID NOT NULL REFERENCES roles(id),
            clerk_user_id  VARCHAR(100) NOT NULL UNIQUE,
            full_name      VARCHAR(150) NOT NULL,
            email          VARCHAR(150) NOT NULL,
            is_active      BOOLEAN NOT NULL DEFAULT TRUE,
            created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at     TIMESTAMP
        )
    """)

    # ------------------------------------------------------------------ #
    # owners  (dueños de mascotas)
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE owners (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id  UUID NOT NULL REFERENCES clinics(id),
            full_name  VARCHAR(150) NOT NULL,
            id_number  VARCHAR(20),
            phone      VARCHAR(20),
            email      VARCHAR(150),
            address    TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMP
        )
    """)

    # ------------------------------------------------------------------ #
    # patients  (mascotas)
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE patients (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id         UUID NOT NULL REFERENCES clinics(id),
            owner_id          UUID NOT NULL REFERENCES owners(id),
            name              VARCHAR(100) NOT NULL,
            species           VARCHAR(50),
            breed             VARCHAR(100),
            birth_date        DATE,
            weight            DECIMAL(5,2),
            vaccination_code  VARCHAR(20) UNIQUE,
            notes             TEXT,
            created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at        TIMESTAMP
        )
    """)

    # ------------------------------------------------------------------ #
    # appointment_services  (tipos de servicio)
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE appointment_services (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id        UUID NOT NULL REFERENCES clinics(id),
            name             VARCHAR(100) NOT NULL,
            service_type     VARCHAR(20) NOT NULL
                             CHECK (service_type IN ('veterinary','grooming')),
            duration_minutes INT NOT NULL DEFAULT 30,
            created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at       TIMESTAMP
        )
    """)

    # ------------------------------------------------------------------ #
    # appointments  (citas)
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE appointments (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id        UUID NOT NULL REFERENCES clinics(id),
            patient_id       UUID NOT NULL REFERENCES patients(id),
            owner_id         UUID NOT NULL REFERENCES owners(id),
            assigned_user_id UUID NOT NULL REFERENCES users(id),
            service_id       UUID NOT NULL REFERENCES appointment_services(id),
            service_type     VARCHAR(20) NOT NULL
                             CHECK (service_type IN ('veterinary','grooming')),
            scheduled_at     TIMESTAMP NOT NULL,
            status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','confirmed','attended','cancelled')),
            notes            TEXT,
            created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at       TIMESTAMP
        )
    """)

    # ------------------------------------------------------------------ #
    # medical_records  (historia clínica)
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE medical_records (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id        UUID NOT NULL REFERENCES clinics(id),
            patient_id       UUID NOT NULL REFERENCES patients(id),
            veterinarian_id  UUID NOT NULL REFERENCES users(id),
            appointment_id   UUID REFERENCES appointments(id),
            reason           TEXT NOT NULL,
            diagnosis        TEXT,
            treatment        TEXT,
            prescriptions    TEXT,
            weight           DECIMAL(5,2),
            temperature      DECIMAL(4,1),
            visit_date       TIMESTAMP NOT NULL DEFAULT NOW(),
            created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at       TIMESTAMP
        )
    """)

    # ------------------------------------------------------------------ #
    # medical_record_attachments
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE medical_record_attachments (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id         UUID NOT NULL REFERENCES clinics(id),
            medical_record_id UUID NOT NULL REFERENCES medical_records(id),
            file_url          TEXT NOT NULL,
            file_name         VARCHAR(200) NOT NULL,
            file_type         VARCHAR(50),
            created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at        TIMESTAMP
        )
    """)

    # ------------------------------------------------------------------ #
    # vaccinations  (vacunas)
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE vaccinations (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id         UUID NOT NULL REFERENCES clinics(id),
            patient_id        UUID NOT NULL REFERENCES patients(id),
            medical_record_id UUID REFERENCES medical_records(id),
            vaccine_name      VARCHAR(150) NOT NULL,
            applied_at        DATE NOT NULL,
            next_dose_at      DATE,
            batch_number      VARCHAR(50),
            created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at        TIMESTAMP
        )
    """)

    # ------------------------------------------------------------------ #
    # reminders  (recordatorios automáticos)
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE reminders (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id    UUID NOT NULL REFERENCES clinics(id),
            patient_id   UUID NOT NULL REFERENCES patients(id),
            owner_id     UUID NOT NULL REFERENCES owners(id),
            type         VARCHAR(50) NOT NULL
                         CHECK (type IN ('appointment_24h','vaccine_due','deworming_due')),
            scheduled_at TIMESTAMP NOT NULL,
            sent_at      TIMESTAMP,
            status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','sent','failed')),
            created_at   TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)

    # ------------------------------------------------------------------ #
    # product_categories
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE product_categories (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id  UUID NOT NULL REFERENCES clinics(id),
            name       VARCHAR(100) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMP
        )
    """)

    # ------------------------------------------------------------------ #
    # products
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE products (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id    UUID NOT NULL REFERENCES clinics(id),
            category_id  UUID REFERENCES product_categories(id),
            name         VARCHAR(150) NOT NULL,
            description  TEXT,
            unit_price   DECIMAL(10,2) NOT NULL DEFAULT 0,
            stock        INT NOT NULL DEFAULT 0,
            min_stock    INT NOT NULL DEFAULT 0,
            created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at   TIMESTAMP
        )
    """)

    # ------------------------------------------------------------------ #
    # stock_movements
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE stock_movements (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id  UUID NOT NULL REFERENCES clinics(id),
            product_id UUID NOT NULL REFERENCES products(id),
            user_id    UUID NOT NULL REFERENCES users(id),
            type       VARCHAR(10) NOT NULL CHECK (type IN ('in','out')),
            quantity   INT NOT NULL,
            reason     VARCHAR(200),
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)

    # ------------------------------------------------------------------ #
    # sales
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE sales (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id  UUID NOT NULL REFERENCES clinics(id),
            owner_id   UUID REFERENCES owners(id),
            patient_id UUID REFERENCES patients(id),
            user_id    UUID NOT NULL REFERENCES users(id),
            total      DECIMAL(10,2) NOT NULL DEFAULT 0,
            status     VARCHAR(20) NOT NULL DEFAULT 'completed'
                       CHECK (status IN ('completed','cancelled')),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMP
        )
    """)

    # ------------------------------------------------------------------ #
    # sale_items
    # ------------------------------------------------------------------ #
    op.execute("""
        CREATE TABLE sale_items (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sale_id    UUID NOT NULL REFERENCES sales(id),
            product_id UUID NOT NULL REFERENCES products(id),
            quantity   INT NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            subtotal   DECIMAL(10,2) NOT NULL
        )
    """)

    # ================================================================== #
    # ROW LEVEL SECURITY
    # ================================================================== #
    rls_tables = [
        "clinic_modules", "roles", "users", "owners", "patients",
        "appointment_services", "appointments", "medical_records",
        "medical_record_attachments", "vaccinations", "reminders",
        "product_categories", "products", "stock_movements", "sales",
    ]

    for table in rls_tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY clinic_isolation ON {table}
            USING (clinic_id = current_setting('app.current_clinic_id', TRUE)::uuid)
        """)

    # sale_items no tiene clinic_id directo — se aísla a través de sales
    # No se aplica RLS directo; el acceso se controla vía JOIN con sales.

    # ================================================================== #
    # Seed de permisos base
    # ================================================================== #
    permissions = [
        # configuración
        "configuration.view", "configuration.edit",
        # usuarios
        "users.view", "users.create", "users.edit", "users.deactivate",
        # owners
        "owners.view", "owners.create", "owners.edit",
        # patients
        "patients.view", "patients.create", "patients.edit",
        # citas
        "appointments.view_all", "appointments.view_own",
        "appointments.create", "appointments.edit", "appointments.cancel",
        # historia clínica
        "medical_records.view", "medical_records.create", "medical_records.edit",
        # productos
        "products.view", "products.manage", "products.stock_in",
        # ventas
        "sales.view", "sales.create", "sales.cancel",
        # reportes
        "reports.view_general", "reports.view_own",
    ]
    for action in permissions:
        op.execute(
            f"INSERT INTO permissions (action) VALUES ('{action}') ON CONFLICT DO NOTHING"
        )


def downgrade() -> None:
    tables = [
        "sale_items", "sales", "stock_movements", "products", "product_categories",
        "reminders", "vaccinations", "medical_record_attachments", "medical_records",
        "appointments", "appointment_services", "patients", "owners",
        "users", "role_permissions", "permissions", "roles",
        "clinic_modules", "clinics",
    ]
    for table in tables:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
