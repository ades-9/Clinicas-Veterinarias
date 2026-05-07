"""Species, breeds, product_units, appointment price, sale improvements

Revision ID: 004
Revises: 003
Create Date: 2026-05-07
"""

from typing import Sequence, Union
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SPECIES = [
    "Perro", "Gato", "Ave", "Conejo", "Reptil",
    "Pez", "Hámster", "Cobaya", "Tortuga", "Otro",
]

_BREEDS = {
    "Perro": [
        "Golden Retriever", "Labrador Retriever", "Pastor Alemán", "Bulldog Francés",
        "Poodle", "Beagle", "Yorkshire Terrier", "Chihuahua", "Shih Tzu",
        "Rottweiler", "Doberman", "Husky Siberiano", "Boxer", "Dálmata",
        "Border Collie", "Bichón Frisé", "Pomerania", "Schnauzer", "Maltés",
        "Cocker Spaniel", "Pitbull", "Bulldog Inglés", "Mestizo",
    ],
    "Gato": [
        "Persa", "Siamés", "Maine Coon", "Ragdoll", "Bengalí",
        "Abisinio", "Sphynx", "Scottish Fold", "Británico de Pelo Corto",
        "Angora", "Bombay", "Mestizo",
    ],
    "Ave": ["Canario", "Periquito", "Loro", "Agaporni", "Cacatúa", "Guacamayo", "Otro"],
    "Conejo": ["Holandés Enano", "Angora", "Rex", "Lionhead", "Belier", "Mestizo"],
    "Reptil": ["Iguana", "Geco Leopardo", "Camaleón", "Tortuga de Tierra", "Serpiente", "Otro"],
}

_UNITS = [
    "unidad", "caja", "frasco", "ampolla", "tableta",
    "cápsula", "ml", "litro", "g", "kg", "dosis",
    "par", "rollo", "sobre", "jeringa",
]


def upgrade() -> None:
    # ── tablas globales ───────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE species (
            id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(80) NOT NULL UNIQUE
        )
    """)

    op.execute("""
        CREATE TABLE breeds (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            species_id UUID NOT NULL REFERENCES species(id),
            name       VARCHAR(100) NOT NULL,
            UNIQUE (species_id, name)
        )
    """)

    op.execute("""
        CREATE TABLE product_units (
            id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(50) NOT NULL UNIQUE
        )
    """)

    # ── seed ─────────────────────────────────────────────────────────────────
    for name in _SPECIES:
        op.execute(f"INSERT INTO species (name) VALUES ('{name}') ON CONFLICT DO NOTHING")

    for species_name, breed_list in _BREEDS.items():
        for breed in breed_list:
            safe = breed.replace("'", "''")
            op.execute(f"""
                INSERT INTO breeds (species_id, name)
                SELECT id, '{safe}' FROM species WHERE name = '{species_name}'
                ON CONFLICT DO NOTHING
            """)

    for unit in _UNITS:
        op.execute(f"INSERT INTO product_units (name) VALUES ('{unit}') ON CONFLICT DO NOTHING")

    # ── patients: reemplazar cols texto por FK ────────────────────────────────
    op.execute("ALTER TABLE patients ADD COLUMN species_id UUID REFERENCES species(id)")
    op.execute("ALTER TABLE patients ADD COLUMN breed_id   UUID REFERENCES breeds(id)")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS species")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS breed")

    # ── appointment_services: agregar precio ─────────────────────────────────
    op.execute("ALTER TABLE appointment_services ADD COLUMN price NUMERIC(12,2) NOT NULL DEFAULT 0")

    # ── sales: agregar appointment_id ────────────────────────────────────────
    op.execute("ALTER TABLE sales ADD COLUMN appointment_id UUID REFERENCES appointments(id)")

    # ── sale_items: soporte para servicios ───────────────────────────────────
    op.execute("ALTER TABLE sale_items ALTER COLUMN product_id DROP NOT NULL")
    op.execute("ALTER TABLE sale_items ADD COLUMN service_id UUID REFERENCES appointment_services(id)")
    op.execute("""
        ALTER TABLE sale_items ADD CONSTRAINT sale_item_one_type CHECK (
            (product_id IS NOT NULL AND service_id IS NULL) OR
            (product_id IS NULL     AND service_id IS NOT NULL)
        )
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_item_one_type")
    op.execute("ALTER TABLE sale_items DROP COLUMN IF EXISTS service_id")
    op.execute("ALTER TABLE sale_items ALTER COLUMN product_id SET NOT NULL")
    op.execute("ALTER TABLE sales DROP COLUMN IF EXISTS appointment_id")
    op.execute("ALTER TABLE appointment_services DROP COLUMN IF EXISTS price")
    op.execute("ALTER TABLE patients ADD COLUMN species VARCHAR(80)")
    op.execute("ALTER TABLE patients ADD COLUMN breed   VARCHAR(80)")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS species_id")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS breed_id")
    op.execute("DROP TABLE IF EXISTS product_units")
    op.execute("DROP TABLE IF EXISTS breeds")
    op.execute("DROP TABLE IF EXISTS species")
