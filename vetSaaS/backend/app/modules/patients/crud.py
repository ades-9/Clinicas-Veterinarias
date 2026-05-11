from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_rls_context
from app.modules.patients.schemas import PatientCreate, PatientRead, PatientUpdate

_PATIENT_SELECT = """
    SELECT p.id, p.clinic_id, p.owner_id, o.full_name AS owner_name,
           p.name, p.species_id, sp.name AS species_name,
           p.breed_id, br.name AS breed_name,
           p.birth_date, p.weight,
           p.sex, p.is_sterilized, p.color, p.microchip_number,
           p.distinctive_marks, p.allergies, p.chronic_conditions,
           p.temperament_notes, p.lifestyle_notes, p.grooming_preferences,
           p.vaccination_code, p.photo_url, p.notes, p.created_at
    FROM patients p
    JOIN owners o ON o.id = p.owner_id
    LEFT JOIN species sp ON sp.id = p.species_id
    LEFT JOIN breeds br ON br.id = p.breed_id
    WHERE p.deleted_at IS NULL
"""


async def list_patients(
    clinic_id: str,
    session: AsyncSession,
    q: str | None = None,
    owner_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[PatientRead]:
    await set_rls_context(session, clinic_id)

    filters = ""
    params: dict = {"limit": limit, "offset": offset}

    if q:
        filters += " AND (p.name ILIKE :q OR p.vaccination_code ILIKE :q OR o.full_name ILIKE :q)"
        params["q"] = f"%{q}%"
    if owner_id:
        filters += " AND p.owner_id = :owner_id"
        params["owner_id"] = owner_id

    result = await session.execute(
        text(f"{_PATIENT_SELECT}{filters} ORDER BY p.name LIMIT :limit OFFSET :offset"),
        params,
    )
    return [PatientRead(**row) for row in result.mappings()]


async def get_patient(patient_id: str, clinic_id: str, session: AsyncSession) -> PatientRead:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text(f"{_PATIENT_SELECT} AND p.id = :id"),
        {"id": patient_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")
    return PatientRead(**row)


async def create_patient(clinic_id: str, data: PatientCreate, session: AsyncSession) -> PatientRead:
    await set_rls_context(session, clinic_id)

    owner_check = await session.execute(
        text("SELECT 1 FROM owners WHERE id = :id AND deleted_at IS NULL"),
        {"id": data.owner_id},
    )
    if owner_check.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propietario no encontrado")

    result = await session.execute(
        text("""
            INSERT INTO patients
                (clinic_id, owner_id, name, species_id, breed_id,
                 birth_date, weight, sex, is_sterilized, color, microchip_number,
                 distinctive_marks, allergies, chronic_conditions,
                 temperament_notes, lifestyle_notes, grooming_preferences,
                 vaccination_code, notes)
            VALUES
                (:clinic_id, :owner_id, :name, :species_id, :breed_id,
                 :birth_date, :weight, :sex, :is_sterilized, :color, :microchip_number,
                 :distinctive_marks, :allergies, :chronic_conditions,
                 :temperament_notes, :lifestyle_notes, :grooming_preferences,
                 :vaccination_code, :notes)
            RETURNING id
        """),
        {"clinic_id": clinic_id, **data.model_dump()},
    )
    patient_id = str(result.scalar_one())
    await session.commit()
    return await get_patient(patient_id, clinic_id, session)


async def update_patient(
    patient_id: str, clinic_id: str, data: PatientUpdate, session: AsyncSession
) -> PatientRead:
    await set_rls_context(session, clinic_id)

    fields = data.model_dump(exclude_unset=True)
    if not fields:
        return await get_patient(patient_id, clinic_id, session)

    if "owner_id" in fields:
        owner_check = await session.execute(
            text("SELECT 1 FROM owners WHERE id = :id AND deleted_at IS NULL"),
            {"id": fields["owner_id"]},
        )
        if owner_check.scalar() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propietario no encontrado")

    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["id"] = patient_id

    result = await session.execute(
        text(f"UPDATE patients SET {set_clause} WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        fields,
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")

    await session.commit()
    return await get_patient(patient_id, clinic_id, session)


async def delete_patient(patient_id: str, clinic_id: str, session: AsyncSession) -> None:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text("UPDATE patients SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        {"id": patient_id},
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")
    await session.commit()
