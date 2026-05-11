from fastapi import HTTPException, status
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_rls_context
from app.modules.medical_records.schemas import (
    AttachmentRead,
    DewormingCreate,
    DewormingRead,
    MedicalRecordCreate,
    MedicalRecordRead,
    MedicalRecordUpdate,
    PrescriptionItemCreate,
    PrescriptionItemRead,
    SurgeryCreate,
    SurgeryRead,
    VaccinationCreate,
    VaccinationRead,
)

_RECORD_SELECT = """
    SELECT mr.id, mr.clinic_id, mr.patient_id, p.name AS patient_name,
           mr.veterinarian_id, u.full_name AS veterinarian_name,
           mr.appointment_id, mr.reason, mr.diagnosis, mr.treatment,
           mr.prescriptions, mr.weight, mr.temperature,
           mr.heart_rate, mr.respiratory_rate, mr.pulse, mr.physical_exam,
           mr.visit_date, mr.created_at,
           a.service_type AS appointment_service_type
    FROM medical_records mr
    JOIN patients p ON p.id = mr.patient_id
    JOIN users u ON u.id = mr.veterinarian_id
    LEFT JOIN appointments a ON a.id = mr.appointment_id AND a.deleted_at IS NULL
    WHERE mr.deleted_at IS NULL
"""


_VACCINATION_COLS = """
    id, clinic_id, patient_id, medical_record_id, vaccine_type_id,
    vaccine_name, manufacturer, applied_at, next_dose_at,
    batch_number, expiration_date, weight_at_application,
    photo_url, applied_externally, external_clinic_name, created_at
"""


async def _bulk_load_vaccinations(
    record_ids: list[str], session: AsyncSession
) -> dict[str, list[VaccinationRead]]:
    if not record_ids:
        return {}
    stmt = text(f"""
        SELECT {_VACCINATION_COLS}
        FROM vaccinations
        WHERE medical_record_id IN :ids AND deleted_at IS NULL
        ORDER BY applied_at
    """).bindparams(bindparam("ids", expanding=True))
    result = await session.execute(stmt, {"ids": record_ids})
    grouped: dict[str, list[VaccinationRead]] = {}
    for row in result.mappings():
        grouped.setdefault(str(row["medical_record_id"]), []).append(VaccinationRead(**row))
    return grouped


async def _bulk_load_attachments(
    record_ids: list[str], session: AsyncSession
) -> dict[str, list[AttachmentRead]]:
    if not record_ids:
        return {}
    stmt = text("""
        SELECT id, clinic_id, medical_record_id, file_url, file_name, file_type, created_at
        FROM medical_record_attachments
        WHERE medical_record_id IN :ids AND deleted_at IS NULL
        ORDER BY created_at
    """).bindparams(bindparam("ids", expanding=True))
    result = await session.execute(stmt, {"ids": record_ids})
    grouped: dict[str, list[AttachmentRead]] = {}
    for row in result.mappings():
        grouped.setdefault(str(row["medical_record_id"]), []).append(AttachmentRead(**row))
    return grouped


_DEWORMING_COLS = """
    id, clinic_id, patient_id, medical_record_id,
    product_name, manufacturer, treatment_type, applied_at, next_dose_at,
    weight_at_application, batch_number, expiration_date,
    notes, photo_url, applied_externally, external_clinic_name, created_at
"""


async def _bulk_load_dewormings(
    record_ids: list[str], session: AsyncSession
) -> dict[str, list[DewormingRead]]:
    if not record_ids:
        return {}
    stmt = text(f"""
        SELECT {_DEWORMING_COLS}
        FROM dewormings
        WHERE medical_record_id IN :ids AND deleted_at IS NULL
        ORDER BY applied_at
    """).bindparams(bindparam("ids", expanding=True))
    result = await session.execute(stmt, {"ids": record_ids})
    grouped: dict[str, list[DewormingRead]] = {}
    for row in result.mappings():
        grouped.setdefault(str(row["medical_record_id"]), []).append(DewormingRead(**row))
    return grouped


async def _bulk_load_surgeries(
    record_ids: list[str], session: AsyncSession
) -> dict[str, list[SurgeryRead]]:
    if not record_ids:
        return {}
    stmt = text("""
        SELECT id, clinic_id, patient_id, medical_record_id,
               name, performed_at, veterinarian_name, description, complications,
               applied_externally, external_clinic_name, created_at
        FROM surgeries
        WHERE medical_record_id IN :ids AND deleted_at IS NULL
        ORDER BY performed_at
    """).bindparams(bindparam("ids", expanding=True))
    result = await session.execute(stmt, {"ids": record_ids})
    grouped: dict[str, list[SurgeryRead]] = {}
    for row in result.mappings():
        grouped.setdefault(str(row["medical_record_id"]), []).append(SurgeryRead(**row))
    return grouped


async def _bulk_load_prescription_items(
    record_ids: list[str], session: AsyncSession
) -> dict[str, list[PrescriptionItemRead]]:
    if not record_ids:
        return {}
    stmt = text("""
        SELECT pi.id, pi.clinic_id, pi.medical_record_id, pi.product_id,
               p.name AS product_name,
               pi.custom_name, pi.dose, pi.frequency, pi.duration, pi.notes, pi.created_at
        FROM prescription_items pi
        LEFT JOIN products p ON p.id = pi.product_id
        WHERE pi.medical_record_id IN :ids AND pi.deleted_at IS NULL
        ORDER BY pi.created_at
    """).bindparams(bindparam("ids", expanding=True))
    result = await session.execute(stmt, {"ids": record_ids})
    grouped: dict[str, list[PrescriptionItemRead]] = {}
    for row in result.mappings():
        grouped.setdefault(str(row["medical_record_id"]), []).append(PrescriptionItemRead(**row))
    return grouped


async def _attach_associations(
    records: list[MedicalRecordRead], session: AsyncSession
) -> None:
    """Bulk-load vaccinations, dewormings, surgeries, prescription_items y attachments en cada record (in-place)."""
    if not records:
        return
    record_ids = [str(r.id) for r in records]
    vaccinations = await _bulk_load_vaccinations(record_ids, session)
    dewormings = await _bulk_load_dewormings(record_ids, session)
    surgeries = await _bulk_load_surgeries(record_ids, session)
    prescriptions = await _bulk_load_prescription_items(record_ids, session)
    attachments = await _bulk_load_attachments(record_ids, session)
    for r in records:
        rid = str(r.id)
        r.vaccinations = vaccinations.get(rid, [])
        r.dewormings = dewormings.get(rid, [])
        r.surgeries = surgeries.get(rid, [])
        r.prescription_items = prescriptions.get(rid, [])
        r.attachments = attachments.get(rid, [])


async def list_records(
    clinic_id: str,
    session: AsyncSession,
    patient_id: str | None = None,
    service_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[MedicalRecordRead]:
    await set_rls_context(session, clinic_id)

    filters = ""
    params: dict = {"limit": limit, "offset": offset}

    if patient_id:
        filters += " AND mr.patient_id = :patient_id"
        params["patient_id"] = patient_id
    if service_type:
        filters += " AND a.service_type = :service_type"
        params["service_type"] = service_type

    result = await session.execute(
        text(f"{_RECORD_SELECT}{filters} ORDER BY mr.visit_date DESC LIMIT :limit OFFSET :offset"),
        params,
    )
    records = [MedicalRecordRead(**row) for row in result.mappings()]
    await _attach_associations(records, session)
    return records


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
    await _attach_associations([record], session)
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
                 weight, temperature, heart_rate, respiratory_rate, pulse, physical_exam,
                 visit_date)
            VALUES
                (:clinic_id, :patient_id, :veterinarian_id, :appointment_id,
                 :reason, :diagnosis, :treatment, :prescriptions,
                 :weight, :temperature, :heart_rate, :respiratory_rate, :pulse, :physical_exam,
                 COALESCE(:visit_date, NOW()))
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
            "heart_rate": data.heart_rate,
            "respiratory_rate": data.respiratory_rate,
            "pulse": data.pulse,
            "physical_exam": data.physical_exam,
            "visit_date": data.visit_date,
        },
    )
    record_id = str(result.scalar_one())

    for vacc in data.vaccinations:
        await _insert_vaccination(clinic_id, data.patient_id, record_id, vacc, session)

    for px in data.prescription_items:
        await _insert_prescription_item(clinic_id, record_id, px, session)

    await session.commit()
    return await get_record(record_id, clinic_id, session)


async def _insert_prescription_item(
    clinic_id: str,
    record_id: str,
    data: PrescriptionItemCreate,
    session: AsyncSession,
) -> None:
    if not data.product_id and not data.custom_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cada prescripción debe tener product_id o custom_name",
        )
    await session.execute(
        text("""
            INSERT INTO prescription_items
                (clinic_id, medical_record_id, product_id, custom_name, dose, frequency, duration, notes)
            VALUES
                (:clinic_id, :record_id, :product_id, :custom_name, :dose, :frequency, :duration, :notes)
        """),
        {
            "clinic_id": clinic_id,
            "record_id": record_id,
            **data.model_dump(),
        },
    )


_VACC_INSERT_COLS = (
    "clinic_id, patient_id, medical_record_id, vaccine_type_id,"
    " vaccine_name, manufacturer, applied_at, next_dose_at,"
    " batch_number, expiration_date, weight_at_application,"
    " applied_externally, external_clinic_name"
)
_VACC_INSERT_PARAMS = (
    ":clinic_id, :patient_id, :record_id, :vaccine_type_id,"
    " :vaccine_name, :manufacturer, :applied_at, :next_dose_at,"
    " :batch_number, :expiration_date, :weight_at_application,"
    " :applied_externally, :external_clinic_name"
)


async def _insert_vaccination(
    clinic_id: str,
    patient_id: str,
    record_id: str,
    data: VaccinationCreate,
    session: AsyncSession,
) -> None:
    await session.execute(
        text(f"""
            INSERT INTO vaccinations ({_VACC_INSERT_COLS})
            VALUES ({_VACC_INSERT_PARAMS})
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


async def add_vaccination_to_record(
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
        text(f"""
            INSERT INTO vaccinations ({_VACC_INSERT_COLS})
            VALUES ({_VACC_INSERT_PARAMS})
            RETURNING {_VACCINATION_COLS}
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


async def add_vaccination_to_patient(
    patient_id: str,
    clinic_id: str,
    data: VaccinationCreate,
    session: AsyncSession,
) -> VaccinationRead:
    await set_rls_context(session, clinic_id)
    await _ensure_patient_exists(patient_id, session)
    result = await session.execute(
        text(f"""
            INSERT INTO vaccinations ({_VACC_INSERT_COLS})
            VALUES (:clinic_id, :patient_id, NULL, :vaccine_type_id,
                    :vaccine_name, :manufacturer, :applied_at, :next_dose_at,
                    :batch_number, :expiration_date, :weight_at_application,
                    :applied_externally, :external_clinic_name)
            RETURNING {_VACCINATION_COLS}
        """),
        {"clinic_id": clinic_id, "patient_id": patient_id, **data.model_dump()},
    )
    vacc_row = result.mappings().first()
    await session.commit()
    return VaccinationRead(**vacc_row)


async def list_patient_vaccinations(
    patient_id: str, clinic_id: str, session: AsyncSession
) -> list[VaccinationRead]:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text(f"""
            SELECT {_VACCINATION_COLS}
            FROM vaccinations
            WHERE patient_id = :patient_id AND deleted_at IS NULL
            ORDER BY applied_at DESC
        """),
        {"patient_id": patient_id},
    )
    return [VaccinationRead(**row) for row in result.mappings()]


# ── Dewormings ────────────────────────────────────────────────────────────────

_DEWORMING_INSERT_COLS = (
    "clinic_id, patient_id, medical_record_id, product_name, manufacturer, treatment_type,"
    " applied_at, next_dose_at, weight_at_application, batch_number, expiration_date, notes,"
    " applied_externally, external_clinic_name"
)
_DEWORMING_INSERT_PARAMS = (
    ":clinic_id, :patient_id, :record_id, :product_name, :manufacturer, :treatment_type,"
    " :applied_at, :next_dose_at, :weight_at_application, :batch_number, :expiration_date, :notes,"
    " :applied_externally, :external_clinic_name"
)


async def _resolve_patient_from_record(record_id: str, session: AsyncSession) -> str:
    row = await session.execute(
        text("SELECT patient_id FROM medical_records WHERE id = :id AND deleted_at IS NULL"),
        {"id": record_id},
    )
    mapping = row.mappings().first()
    if mapping is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Historia clínica no encontrada")
    return str(mapping["patient_id"])


async def _ensure_patient_exists(patient_id: str, session: AsyncSession) -> None:
    row = await session.execute(
        text("SELECT 1 FROM patients WHERE id = :id AND deleted_at IS NULL"),
        {"id": patient_id},
    )
    if row.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")


async def add_deworming_to_record(
    record_id: str, clinic_id: str, data: DewormingCreate, session: AsyncSession
) -> DewormingRead:
    await set_rls_context(session, clinic_id)
    patient_id = await _resolve_patient_from_record(record_id, session)
    result = await session.execute(
        text(f"""
            INSERT INTO dewormings ({_DEWORMING_INSERT_COLS})
            VALUES ({_DEWORMING_INSERT_PARAMS})
            RETURNING {_DEWORMING_COLS}
        """),
        {"clinic_id": clinic_id, "patient_id": patient_id, "record_id": record_id, **data.model_dump()},
    )
    deworming = DewormingRead(**result.mappings().first())
    await session.commit()
    return deworming


async def add_deworming_to_patient(
    patient_id: str, clinic_id: str, data: DewormingCreate, session: AsyncSession
) -> DewormingRead:
    await set_rls_context(session, clinic_id)
    await _ensure_patient_exists(patient_id, session)
    result = await session.execute(
        text(f"""
            INSERT INTO dewormings ({_DEWORMING_INSERT_COLS})
            VALUES (:clinic_id, :patient_id, NULL, :product_name, :manufacturer, :treatment_type,
                    :applied_at, :next_dose_at, :weight_at_application, :batch_number, :expiration_date, :notes,
                    :applied_externally, :external_clinic_name)
            RETURNING {_DEWORMING_COLS}
        """),
        {"clinic_id": clinic_id, "patient_id": patient_id, **data.model_dump()},
    )
    deworming = DewormingRead(**result.mappings().first())
    await session.commit()
    return deworming


# ── Surgeries ─────────────────────────────────────────────────────────────────

_SURGERY_RETURNING = """
    RETURNING id, clinic_id, patient_id, medical_record_id,
              name, performed_at, veterinarian_name, description, complications,
              applied_externally, external_clinic_name, created_at
"""


async def add_surgery_to_record(
    record_id: str, clinic_id: str, data: SurgeryCreate, session: AsyncSession
) -> SurgeryRead:
    await set_rls_context(session, clinic_id)
    patient_id = await _resolve_patient_from_record(record_id, session)
    result = await session.execute(
        text(f"""
            INSERT INTO surgeries
                (clinic_id, patient_id, medical_record_id, name, performed_at,
                 veterinarian_name, description, complications,
                 applied_externally, external_clinic_name)
            VALUES
                (:clinic_id, :patient_id, :record_id, :name, :performed_at,
                 :veterinarian_name, :description, :complications,
                 :applied_externally, :external_clinic_name)
            {_SURGERY_RETURNING}
        """),
        {"clinic_id": clinic_id, "patient_id": patient_id, "record_id": record_id, **data.model_dump()},
    )
    surgery = SurgeryRead(**result.mappings().first())
    await session.commit()
    return surgery


async def add_surgery_to_patient(
    patient_id: str, clinic_id: str, data: SurgeryCreate, session: AsyncSession
) -> SurgeryRead:
    await set_rls_context(session, clinic_id)
    await _ensure_patient_exists(patient_id, session)
    result = await session.execute(
        text(f"""
            INSERT INTO surgeries
                (clinic_id, patient_id, medical_record_id, name, performed_at,
                 veterinarian_name, description, complications,
                 applied_externally, external_clinic_name)
            VALUES
                (:clinic_id, :patient_id, NULL, :name, :performed_at,
                 :veterinarian_name, :description, :complications,
                 :applied_externally, :external_clinic_name)
            {_SURGERY_RETURNING}
        """),
        {"clinic_id": clinic_id, "patient_id": patient_id, **data.model_dump()},
    )
    surgery = SurgeryRead(**result.mappings().first())
    await session.commit()
    return surgery


# ── Patient-scoped listing (incluye antecedentes sin consulta) ────────────────

async def list_patient_dewormings(
    patient_id: str, clinic_id: str, session: AsyncSession
) -> list[DewormingRead]:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text(f"""
            SELECT {_DEWORMING_COLS}
            FROM dewormings
            WHERE patient_id = :patient_id AND deleted_at IS NULL
            ORDER BY applied_at DESC
        """),
        {"patient_id": patient_id},
    )
    return [DewormingRead(**row) for row in result.mappings()]


async def list_patient_surgeries(
    patient_id: str, clinic_id: str, session: AsyncSession
) -> list[SurgeryRead]:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text("""
            SELECT id, clinic_id, patient_id, medical_record_id,
                   name, performed_at, veterinarian_name, description, complications,
                   applied_externally, external_clinic_name, created_at
            FROM surgeries
            WHERE patient_id = :patient_id AND deleted_at IS NULL
            ORDER BY performed_at DESC
        """),
        {"patient_id": patient_id},
    )
    return [SurgeryRead(**row) for row in result.mappings()]
