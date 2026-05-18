"""Seed de datos de prueba para probar paginación y filtros.

Inserta propietarios (con cédulas ecuatorianas válidas), mascotas, productos,
movimientos de stock, y citas distribuidas en el pasado/presente/futuro.

Uso:
    python -m scripts.seed_demo_data                # usa la primera clínica encontrada
    python -m scripts.seed_demo_data --clinic-id <uuid>
    python -m scripts.seed_demo_data --reset        # borra los registros sembrados antes

Los datos se marcan con el prefijo de notas/SKU "DEMO" para poder limpiarlos
con --reset sin tocar datos reales.
"""

import argparse
import asyncio
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import bindparam, text

from app.core.database import AsyncSessionLocal, set_rls_context

DEMO_TAG = "DEMO"

NOMBRES = [
    "Ana", "Carlos", "María", "Luis", "Sofía", "Pedro", "Lucía", "Andrés",
    "Valentina", "Juan", "Camila", "Diego", "Isabella", "Mateo", "Emma",
    "Sebastián", "Daniela", "Nicolás", "Paula", "Tomás", "Renata", "Felipe",
    "Martina", "Joaquín", "Antonella", "Benjamín", "Catalina", "Esteban",
    "Florencia", "Gabriel", "Helena", "Ignacio", "Julieta", "Kevin", "Laura",
    "Mauricio", "Natalia", "Oscar", "Patricia", "Quito", "Rodrigo", "Silvia",
    "Tatiana", "Ulises", "Verónica", "Walter", "Ximena", "Yolanda", "Zacarías",
    "Adriana", "Boris",
]
APELLIDOS = [
    "García", "Pérez", "López", "Rodríguez", "Martínez", "Vargas",
    "Castro", "Mendoza", "Salazar", "Cevallos", "Andrade", "Bravo",
    "Calle", "Espinoza", "Flores", "Guerrero", "Herrera", "Iturralde",
    "Jaramillo", "Karolys", "Loor", "Moreira", "Naranjo", "Ortiz",
    "Paredes", "Quintana", "Robalino", "Sánchez", "Tinoco", "Ulloa",
    "Vega", "Yánez",
]
NOMBRES_MASCOTAS = [
    "Luna", "Max", "Rocky", "Bella", "Toby", "Lola", "Coco", "Simba",
    "Chloe", "Bruno", "Mia", "Thor", "Daisy", "Charlie", "Nala", "Leo",
    "Maya", "Apolo", "Lily", "Zeus", "Kira", "Hachi", "Pepe", "Princesa",
    "Rex", "Sasha", "Tomy", "Vicky", "Lassie", "Snoopy",
]
DIRECCIONES = [
    "Av. Amazonas N32-45 y Atahualpa",
    "García Moreno OE3-12 y Sucre",
    "Av. 6 de Diciembre N28-110",
    "Calle Vicente Rocafuerte 543",
    "Av. de los Shyris N37-89",
    "Av. Eloy Alfaro N48-93",
    "Av. República E5-89",
    "10 de Agosto N17-22",
    "Av. América N32-450",
    "Av. La Prensa N48-100",
]
PRODUCTOS_DEMO = [
    ("Amoxicilina 250mg", "med", True, Decimal("8.50"), "unidad"),
    ("Doxiciclina 100mg", "med", True, Decimal("12.00"), "unidad"),
    ("Enrofloxacina inyectable 50ml", "med", True, Decimal("22.00"), "frasco"),
    ("Metronidazol 500mg", "med", True, Decimal("9.80"), "unidad"),
    ("Carprofeno 50mg", "med", True, Decimal("15.00"), "unidad"),
    ("Meloxicam suspensión 32ml", "med", True, Decimal("18.00"), "frasco"),
    ("Ivermectina 1% 10ml", "med", True, Decimal("11.00"), "frasco"),
    ("Frontline Plus perro M", "antip", False, Decimal("14.50"), "unidad"),
    ("Bravecto 250mg", "antip", False, Decimal("32.00"), "unidad"),
    ("Drontal Plus", "antip", False, Decimal("9.00"), "unidad"),
    ("Vacuna Quintuple", "vac", True, Decimal("18.00"), "dosis"),
    ("Vacuna Antirrábica", "vac", True, Decimal("12.00"), "dosis"),
    ("Vacuna Triple Felina", "vac", True, Decimal("16.00"), "dosis"),
    ("Hill's Science Diet Adult 7.5kg", "alim", False, Decimal("45.00"), "saco"),
    ("Royal Canin Maxi Adult 15kg", "alim", False, Decimal("78.00"), "saco"),
    ("Pro Plan Puppy 7.5kg", "alim", False, Decimal("52.00"), "saco"),
    ("Whiskas Adulto sabor pollo", "alim", False, Decimal("4.50"), "unidad"),
    ("Shampoo medicado 250ml", "high", False, Decimal("9.50"), "frasco"),
    ("Toallitas húmedas", "high", False, Decimal("5.00"), "paquete"),
    ("Cepillo desenredante", "acc", False, Decimal("11.00"), "unidad"),
    ("Collar antipulgas", "acc", False, Decimal("13.50"), "unidad"),
    ("Correa retráctil", "acc", False, Decimal("17.00"), "unidad"),
    ("Bozal silicona M", "acc", False, Decimal("8.50"), "unidad"),
    ("Plato doble acero", "acc", False, Decimal("12.00"), "unidad"),
    ("Hueso dental L", "snack", False, Decimal("2.50"), "unidad"),
    ("Snack premio salmón", "snack", False, Decimal("6.50"), "paquete"),
    ("Jeringuilla 5ml", "ins", False, Decimal("0.40"), "unidad"),
    ("Gasa estéril", "ins", False, Decimal("1.20"), "paquete"),
    ("Esparadrapo", "ins", False, Decimal("3.20"), "unidad"),
    ("Algodón hidrófilo 500g", "ins", False, Decimal("8.00"), "paquete"),
]
CATEGORIAS_DEMO = {
    "med": "Medicamentos",
    "antip": "Antiparasitarios",
    "vac": "Vacunas",
    "alim": "Alimentos",
    "high": "Higiene",
    "acc": "Accesorios",
    "snack": "Snacks",
    "ins": "Insumos clínicos",
}


def gen_ec_id_number(rng: random.Random) -> str:
    """Genera una cédula ecuatoriana de 10 dígitos válida."""
    province = rng.randint(1, 24)
    third = rng.randint(0, 5)
    digits = [
        province // 10, province % 10, third,
        rng.randint(0, 9), rng.randint(0, 9), rng.randint(0, 9),
        rng.randint(0, 9), rng.randint(0, 9), rng.randint(0, 9),
    ]
    coefs = [2, 1, 2, 1, 2, 1, 2, 1, 2]
    total = 0
    for d, c in zip(digits, coefs):
        prod = d * c
        if prod >= 10:
            prod -= 9
        total += prod
    verifier = (10 - (total % 10)) % 10
    return "".join(str(d) for d in digits) + str(verifier)


def gen_phone(rng: random.Random) -> str:
    return "09" + "".join(str(rng.randint(0, 9)) for _ in range(8))


async def get_clinic_id(session, requested: str | None) -> str:
    if requested:
        check = await session.execute(
            text("SELECT 1 FROM clinics WHERE id = :id"), {"id": requested}
        )
        if check.scalar() is None:
            raise SystemExit(f"No existe la clínica {requested}")
        return requested
    row = await session.execute(
        text("SELECT id FROM clinics WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1")
    )
    val = row.scalar()
    if not val:
        raise SystemExit("No hay ninguna clínica registrada. Hace falta hacer el onboarding primero.")
    return str(val)


async def reset_demo(session, clinic_id: str) -> None:
    """Borra (físicamente) todos los registros marcados como DEMO."""
    await set_rls_context(session, clinic_id)
    print(f"  - Limpiando datos DEMO previos de clinica {clinic_id}...")

    # Orden: dependencias primero
    await session.execute(text(
        "DELETE FROM appointment_service_links WHERE appointment_id IN "
        "(SELECT id FROM appointments WHERE notes LIKE 'DEMO%')"
    ))
    await session.execute(text("DELETE FROM appointments WHERE notes LIKE 'DEMO%'"))
    await session.execute(text(
        "DELETE FROM stock_movements WHERE reason LIKE 'DEMO%' "
        "OR product_id IN (SELECT id FROM products WHERE sku LIKE 'DEMO-%')"
    ))
    await session.execute(text("DELETE FROM products WHERE sku LIKE 'DEMO-%'"))
    await session.execute(
        text("DELETE FROM product_categories WHERE name IN :names")
        .bindparams(bindparam("names", expanding=True)),
        {"names": list(CATEGORIAS_DEMO.values())},
    )
    await session.execute(text("DELETE FROM patients WHERE notes LIKE 'DEMO%'"))
    await session.execute(text("DELETE FROM owners WHERE address LIKE 'DEMO%'"))
    await session.commit()


async def seed_owners(session, clinic_id: str, rng: random.Random, n: int) -> list[str]:
    print(f"  - Creando {n} propietarios...")
    ids: list[str] = []
    used_cedulas: set[str] = set()
    for _ in range(n):
        nombre = f"{rng.choice(NOMBRES)} {rng.choice(APELLIDOS)} {rng.choice(APELLIDOS)}"
        # Asegurar cédula única
        for _try in range(10):
            cedula = gen_ec_id_number(rng)
            if cedula not in used_cedulas:
                break
        used_cedulas.add(cedula)
        email = (
            nombre.lower()
            .replace(" ", ".")
            .replace("á", "a").replace("é", "e").replace("í", "i")
            .replace("ó", "o").replace("ú", "u").replace("ñ", "n")
            + f"{rng.randint(10, 999)}@demo.com"
        )
        contact = rng.choice(["whatsapp", "sms", "email", "phone", None])
        # Marcamos el seed con "DEMO · " en address
        address = f"DEMO · {rng.choice(DIRECCIONES)}"
        res = await session.execute(text("""
            INSERT INTO owners (clinic_id, full_name, id_number, phone, email, address, preferred_contact)
            VALUES (:clinic_id, :full_name, :id_number, :phone, :email, :address, :preferred_contact)
            RETURNING id
        """), {
            "clinic_id": clinic_id,
            "full_name": nombre,
            "id_number": cedula,
            "phone": gen_phone(rng),
            "email": email,
            "address": address,
            "preferred_contact": contact,
        })
        ids.append(str(res.scalar_one()))
    return ids


async def seed_patients(
    session, clinic_id: str, owner_ids: list[str], rng: random.Random, n: int
) -> list[str]:
    print(f"  - Creando {n} mascotas...")
    # Cargar especies y razas existentes (vienen del catálogo seed)
    sp_res = await session.execute(text("SELECT id, name FROM species ORDER BY name"))
    species = [(str(r["id"]), r["name"]) for r in sp_res.mappings()]
    if not species:
        species = [(None, None)]
    breeds_by_species: dict[str | None, list[tuple[str, str]]] = {}
    for sp_id, _ in species:
        if sp_id:
            br_res = await session.execute(
                text("SELECT id, name FROM breeds WHERE species_id = :sid"),
                {"sid": sp_id},
            )
            breeds_by_species[sp_id] = [(str(r["id"]), r["name"]) for r in br_res.mappings()]
        else:
            breeds_by_species[None] = []

    ids: list[str] = []
    today = datetime.now().date()
    for _ in range(n):
        sp_id, _sp_name = rng.choice(species)
        breeds = breeds_by_species.get(sp_id, [])
        br_id = rng.choice(breeds)[0] if breeds and rng.random() < 0.7 else None
        age_days = rng.randint(60, 365 * 14)
        birth = today - timedelta(days=age_days)
        weight = Decimal(str(round(rng.uniform(0.5, 45.0), 2)))
        sex = rng.choice(["male", "female"])
        is_sterilized = rng.choice([True, False, None])

        res = await session.execute(text("""
            INSERT INTO patients
                (clinic_id, owner_id, name, species_id, breed_id, birth_date,
                 weight, sex, is_sterilized, notes)
            VALUES (:clinic_id, :owner_id, :name, :species_id, :breed_id, :birth_date,
                    :weight, :sex, :is_sterilized, :notes)
            RETURNING id
        """), {
            "clinic_id": clinic_id,
            "owner_id": rng.choice(owner_ids),
            "name": rng.choice(NOMBRES_MASCOTAS),
            "species_id": sp_id,
            "breed_id": br_id,
            "birth_date": birth,
            "weight": weight,
            "sex": sex,
            "is_sterilized": is_sterilized,
            "notes": "DEMO seed",
        })
        ids.append(str(res.scalar_one()))
    return ids


async def seed_products(session, clinic_id: str, rng: random.Random) -> list[str]:
    print(f"  - Creando categorías de productos...")
    cat_ids: dict[str, str] = {}
    for code, name in CATEGORIAS_DEMO.items():
        res = await session.execute(text("""
            INSERT INTO product_categories (clinic_id, name) VALUES (:clinic_id, :name)
            RETURNING id
        """), {"clinic_id": clinic_id, "name": name})
        cat_ids[code] = str(res.scalar_one())

    print(f"  - Creando {len(PRODUCTOS_DEMO)} productos...")
    product_ids: list[str] = []
    for idx, (name, cat_code, is_med, price, unit) in enumerate(PRODUCTOS_DEMO):
        sku = f"DEMO-{idx + 1:03d}"
        cost = price * Decimal("0.6")
        initial_stock = Decimal(rng.randint(0, 80))
        min_stock = Decimal(rng.randint(5, 15))
        res = await session.execute(text("""
            INSERT INTO products
                (clinic_id, category_id, name, sku, unit, price, cost,
                 stock, min_stock, is_medication, is_active)
            VALUES (:clinic_id, :category_id, :name, :sku, :unit, :price, :cost,
                    :stock, :min_stock, :is_medication, TRUE)
            RETURNING id
        """), {
            "clinic_id": clinic_id,
            "category_id": cat_ids[cat_code],
            "name": name,
            "sku": sku,
            "unit": unit,
            "price": price,
            "cost": cost,
            "stock": initial_stock,
            "min_stock": min_stock,
            "is_medication": is_med,
        })
        product_ids.append(str(res.scalar_one()))

    print(f"  - Creando movimientos de stock de prueba...")
    for pid in product_ids:
        # 1-3 movimientos por producto
        for _ in range(rng.randint(1, 3)):
            mv_type = rng.choices(["entry", "exit", "adjustment"], weights=[5, 3, 1])[0]
            qty = Decimal(rng.randint(1, 20))
            await session.execute(text("""
                INSERT INTO stock_movements
                    (clinic_id, product_id, movement_type, quantity, reason)
                VALUES (:clinic_id, :product_id, :movement_type, :quantity, :reason)
            """), {
                "clinic_id": clinic_id,
                "product_id": pid,
                "movement_type": mv_type,
                "quantity": qty,
                "reason": f"DEMO {mv_type}",
            })
    return product_ids


async def seed_appointments(
    session, clinic_id: str, patient_ids: list[str], rng: random.Random, n: int
) -> None:
    print(f"  - Creando {n} citas...")
    # Necesitamos al menos un usuario y un servicio existentes
    user_res = await session.execute(text(
        "SELECT id FROM users WHERE deleted_at IS NULL AND is_active = TRUE"
    ))
    user_ids = [str(r["id"]) for r in user_res.mappings()]
    if not user_ids:
        print("    [WARN] Sin usuarios activos. Saltando citas.")
        return

    svc_res = await session.execute(text("""
        SELECT id, service_type, duration_minutes
        FROM appointment_services WHERE deleted_at IS NULL
    """))
    services = [(str(r["id"]), r["service_type"], r["duration_minutes"]) for r in svc_res.mappings()]
    if not services:
        print("    [WARN] Sin servicios configurados. Saltando citas.")
        return

    owner_lookup = await session.execute(text("""
        SELECT id, owner_id FROM patients WHERE deleted_at IS NULL
    """))
    patient_to_owner = {str(r["id"]): str(r["owner_id"]) for r in owner_lookup.mappings()}

    statuses = ["pending", "confirmed", "attended", "cancelled"]
    weights = [3, 3, 4, 1]
    now = datetime.now(timezone.utc)

    for _ in range(n):
        pid = rng.choice(patient_ids)
        oid = patient_to_owner.get(pid)
        if not oid:
            continue
        svc_id, svc_type, _dur = rng.choice(services)
        # Distribución: 40% pasado, 20% próximas 24h, 40% futuro
        bucket = rng.random()
        if bucket < 0.4:
            scheduled = now - timedelta(days=rng.randint(1, 90), hours=rng.randint(0, 23))
            status = rng.choices(["attended", "cancelled"], weights=[8, 2])[0]
        elif bucket < 0.6:
            scheduled = now + timedelta(hours=rng.randint(1, 23))
            status = rng.choice(["pending", "confirmed"])
        else:
            scheduled = now + timedelta(days=rng.randint(1, 60), hours=rng.randint(8, 18))
            status = rng.choices(statuses, weights=weights)[0]

        appt_res = await session.execute(text("""
            INSERT INTO appointments
                (clinic_id, patient_id, owner_id, assigned_user_id, service_type,
                 scheduled_at, status, notes)
            VALUES (:clinic_id, :patient_id, :owner_id, :assigned_user_id, :service_type,
                    :scheduled_at, :status, :notes)
            RETURNING id
        """), {
            "clinic_id": clinic_id,
            "patient_id": pid,
            "owner_id": oid,
            "assigned_user_id": rng.choice(user_ids),
            "service_type": svc_type,
            "scheduled_at": scheduled,
            "status": status,
            "notes": "DEMO cita",
        })
        appt_id = str(appt_res.scalar_one())
        await session.execute(text("""
            INSERT INTO appointment_service_links (appointment_id, service_id, position)
            VALUES (:appt_id, :svc_id, 0)
        """), {"appt_id": appt_id, "svc_id": svc_id})


async def run(args: argparse.Namespace) -> None:
    rng = random.Random(args.seed)
    async with AsyncSessionLocal() as session:
        clinic_id = await get_clinic_id(session, args.clinic_id)
        print(f"\nClínica: {clinic_id}")
        await set_rls_context(session, clinic_id)

        if args.reset:
            await reset_demo(session, clinic_id)

        owner_ids = await seed_owners(session, clinic_id, rng, args.owners)
        await session.commit()
        await set_rls_context(session, clinic_id)

        patient_ids = await seed_patients(session, clinic_id, owner_ids, rng, args.patients)
        await session.commit()
        await set_rls_context(session, clinic_id)

        await seed_products(session, clinic_id, rng)
        await session.commit()
        await set_rls_context(session, clinic_id)

        await seed_appointments(session, clinic_id, patient_ids, rng, args.appointments)
        await session.commit()

    print("\n[OK] Seed completo.")


def main() -> None:
    p = argparse.ArgumentParser(description="Seed de datos demo")
    p.add_argument("--clinic-id", help="UUID de la clínica (default: primera clínica)")
    p.add_argument("--reset", action="store_true", help="Borrar registros DEMO previos")
    p.add_argument("--owners", type=int, default=50)
    p.add_argument("--patients", type=int, default=80)
    p.add_argument("--appointments", type=int, default=100)
    p.add_argument("--seed", type=int, default=42, help="Semilla aleatoria para reproducibilidad")
    args = p.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
