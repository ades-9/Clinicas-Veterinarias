from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_rls_context
from app.modules.medical_records.schemas import (
    AttachmentRead,
    MedicalRecordCreate,
    MedicalRecordRead,
    MedicalRecordUpdate,
    VaccinationCreate,
    VaccinationRead,
)

_RECORD_SELECT = """
    SELECT mr.id, mr.clinic_id, mr.patient_id, p.name AS patient_name,
           mr.veterinarian_id, u.full_name AS veterinarian_name,
           mr.appointment_id, mr.reason, mr.diagnosis, mr.treatment,
           mr.prescriptions, mr.weight, mr.temperature, mr.visit_date, mr.created_at
    FROM medical_records mr
    JOIN patients p ON p.id = mr.patient_id
    JOIN users u ON u.id = mr.veterinarian_id
    WHERE mr.deleted_at IS NULL
"""


async def _load_vaccinations(record_id: str, session: AsyncSession) -> list[VaccinationRead]:
    result = await session.execute(
        text("""
            SELECT id, clinic_id, patient_id, medical_record_id,
                   vaccine_name, applied_at, next_dose_at, batch_number, created_at
            FROM vaccinations
            WHERE medical_record_id = :record_id AND deleted_at IS NULL
            ORDER BY applied_at
        """),
        {"record_id": record_id},
    )
    return [VaccinationRead(**row) for row in result.mappings()]


async def _load_attachments(record_id: str, session: AsyncSession) -> list[AttachmentRead]:
    result = await session.execute(
        text("""
            SELECT id, clinic_id, medical_record_id, file_url, file_name, file_type, created_at
            FROM medical_record_attachments
            WHERE medical_record_id = :record_id AND deleted_at IS NULL
            ORDER BY created_at
        """),
        {"record_id": record_id},
    )
    return [AttachmentRead(**row) for row in result.mappings()]


async def list_records(
    clinic_id: str,
    session: AsyncSession,
    patient_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[MedicalRecordRead]:
    await set_rls_context(session, clinic_id)

    filters = ""
    params: dict = {"limit": limit, "offset": offset}

    if patient_id:
        filters += " AND mr.patient_id = :patient_id"
        params["patient_id"] = patient_id

    result = await session.execute(
        text(f"{_RECORD_SELECT}{filters} ORDER BY mr.visit_date DESC LIMIT :limit OFFSET :offset"),
        params,
    )
    return [MedicalRecordRead(**row) for row in result.mappings()]


async def get_record(record_id: str, clinic_id: str, session: AsyncSession) -> MedicalRecordRead:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text(f"{_RECORD_SELECT} AND mr.id = :id"),
        {"id": record_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Historia clínica no encontrada")

    record = MedicalRecordRead(**row)
    record.vaccinations = await _load_vaccinations(str(record.id), session)
    record.attachments = await _load_attachments(str(record.id), session)
    return record


async def create_record(
    clinic_id: str, veterinarian_clerk_id: str, data: MedicalRecordCreate, session: AsyncSession
) -> MedicalRecordRead:
    await set_rls_context(session, clinic_id)

    patient_check = await session.execute(
        text("SELECT 1 FROM patients WHERE id = :id AND deleted_at IS NULL"),
        {"id": data.patient_id},
    )
    if patient_check.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")

    vet_row = await session.execute(
        text("SELECT id FROM users WHERE clerk_user_id = :clerk_id AND deleted_at IS NULL LIMIT 1"),
        {"clerk_id": veterinarian_clerk_id},
    )
    vet_id = vet_row.scalar()
    if vet_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veterinario no encontrado")

    if data.appointment_id:
        appt_check = await session.execute(
            text("SELECT 1 FROM appointments WHERE id = :id AND deleted_at IS NULL"),
            {"id": data.appointment_id},
        )
        if appt_check.scalar() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")

    result = await session.execute(
        text("""
            INSERT INTO medical_records
                (clinic_id, patient_id, veterinarian_id, appointment_id,
                 reason, diagnosis, treatment, prescriptions,
                 weight, temperature, visit_date)
            VALUES
                (:clinic_id, :patient_id, :veterinarian_id, :appointment_id,
                 :reason, :diagnosis, :treatment, :prescriptions,
                 :weight, :temperature, COALESCE(:visit_date, NOW()))
            RETURNING id
        """),
        {
            "clinic_id": clinic_id,
            "patient_id": data.patient_id,
            "veterinarian_id": str(vet_id),
            "appointment_id": data.appointment_id,
            "reason": data.reason,
            "diagnosis": data.diagnosis,
            "treatment": data.treatment,
            "prescriptions": data.prescriptions,
            "weight": data.weight,
            "temperature": data.temperature,
            "visit_date": data.visit_date,
        },
    )
    record_id = str(result.scalar_one())

    for vacc in data.vaccinations:
        await _insert_vaccination(clinic_id, data.patient_id, record_id, vacc, session)

    await session.commit()
    return await get_record(record_id, clinic_id, session)


async def _insert_vaccination(
    clinic_id: str,
    patient_id: str,
    record_id: str,
    data: VaccinationCreate,
    session: AsyncSession,
) -> None:
    await session.execute(
        text("""
            INSERT INTO vaccinations
                (clinic_id, patient_id, medical_record_id, vaccine_name, applied_at, next_dose_at, batch_number)
            VALUES
                (:clinic_id, :patient_id, :record_id, :vaccine_name, :applied_at, :next_dose_at, :batch_number)
        """),
        {
            "clinic_id": clinic_id,
            "patient_id": patient_id,
            "record_id": record_id,
            **data.model_dump(),
        },
    )


async def update_record(
    record_id: str, clinic_id: str, data: MedicalRecordUpdate, session: AsyncSession
) -> MedicalRecordRead:
    await set_rls_context(session, clinic_id)
    fields = data.model_dump(exclude_unset=True)
    if not fields:
        return await get_record(record_id, clinic_id, session)

    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["id"] = record_id
    result = await session.execute(
        text(f"UPDATE medical_records SET {set_clause} WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        fields,
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Historia clínica no encontrada")
    await session.commit()
    return await get_record(record_id, clinic_id, session)


async def add_attachment(
    record_id: str,
    clinic_id: str,
    file_url: str,
    file_name: str,
    file_type: str | None,
    session: AsyncSession,
) -> AttachmentRead:
    await set_rls_context(session, clinic_id)

    record_check = await session.execute(
        text("SELECT 1 FROM medical_records WHERE id = :id AND deleted_at IS NULL"),
        {"id": record_id},
    )
    if record_check.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Historia clínica no encontrada")

    result = await session.execute(
        text("""
            INSERT INTO medical_record_attachments
                (clinic_id, medical_record_id, file_url, file_name, file_type)
            VALUES (:clinic_id, :record_id, :file_url, :file_name, :file_type)
            RETURNING id, clinic_id, medical_record_id, file_url, file_name, file_type, created_at
        """),
        {
            "clinic_id": clinic_id,
            "record_id": record_id,
            "file_url": file_url,
            "file_name": file_name,
            "file_type": file_type,
        },
    )
    row = result.mappings().first()
    await session.commit()
    return AttachmentRead(**row)


async def add_vaccination(
    record_id: str,
    clinic_id: str,
    data: VaccinationCreate,
    session: AsyncSession,
) -> VaccinationRead:
    await set_rls_context(session, clinic_id)

    record_check = await session.execute(
        text("SELECT patient_id FROM medical_records WHERE id = :id AND deleted_at IS NULL"),
        {"id": record_id},
    )
    row = record_check.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Historia clínica no encontrada")

    result = await session.execute(
        text("""
            INSERT INTO vaccinations
                (clinic_id, patient_id, medical_record_id, vaccine_name, applied_at, next_dose_at, batch_number)
            VALUES
                (:clinic_id, :patient_id, :record_id, :vaccine_name, :applied_at, :next_dose_at, :batch_number)
            RETURNING id, clinic_id, patient_id, medical_record_id,
                      vaccine_name, applied_at, next_dose_at, batch_number, created_at
        """),
        {
            "clinic_id": clinic_id,
            "patient_id": str(row["patient_id"]),
            "record_id": record_id,
            **data.model_dump(),
        },
    )
    vacc_row = result.mappings().first()
    await session.commit()
    return VaccinationRead(**vacc_row)
