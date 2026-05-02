from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_rls_context
from app.modules.appointments.schemas import (
    AppointmentCreate,
    AppointmentRead,
    AppointmentServiceCreate,
    AppointmentServiceRead,
    AppointmentServiceUpdate,
    AppointmentUpdate,
)

_SERVICE_SELECT = """
    SELECT id, clinic_id, name, service_type, duration_minutes, created_at
    FROM appointment_services
    WHERE deleted_at IS NULL
"""

_APPOINTMENT_SELECT = """
    SELECT a.id, a.clinic_id, a.patient_id, p.name AS patient_name,
           a.owner_id, o.full_name AS owner_name,
           a.assigned_user_id, u.full_name AS assigned_user_name,
           a.service_id, svc.name AS service_name,
           a.service_type, a.scheduled_at, a.status, a.notes, a.created_at
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN owners o ON o.id = a.owner_id
    JOIN users u ON u.id = a.assigned_user_id
    JOIN appointment_services svc ON svc.id = a.service_id
    WHERE a.deleted_at IS NULL
"""


# ---- appointment services ----

async def list_services(clinic_id: str, session: AsyncSession) -> list[AppointmentServiceRead]:
    await set_rls_context(session, clinic_id)
    result = await session.execute(text(f"{_SERVICE_SELECT} ORDER BY name"))
    return [AppointmentServiceRead(**row) for row in result.mappings()]


async def get_service(service_id: str, clinic_id: str, session: AsyncSession) -> AppointmentServiceRead:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text(f"{_SERVICE_SELECT} AND id = :id"),
        {"id": service_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Servicio no encontrado")
    return AppointmentServiceRead(**row)


async def create_service(clinic_id: str, data: AppointmentServiceCreate, session: AsyncSession) -> AppointmentServiceRead:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text("""
            INSERT INTO appointment_services (clinic_id, name, service_type, duration_minutes)
            VALUES (:clinic_id, :name, :service_type, :duration_minutes)
            RETURNING id
        """),
        {"clinic_id": clinic_id, **data.model_dump()},
    )
    service_id = str(result.scalar_one())
    await session.commit()
    return await get_service(service_id, clinic_id, session)


async def update_service(
    service_id: str, clinic_id: str, data: AppointmentServiceUpdate, session: AsyncSession
) -> AppointmentServiceRead:
    await set_rls_context(session, clinic_id)
    fields = data.model_dump(exclude_unset=True)
    if not fields:
        return await get_service(service_id, clinic_id, session)

    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["id"] = service_id
    result = await session.execute(
        text(f"UPDATE appointment_services SET {set_clause} WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        fields,
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Servicio no encontrado")
    await session.commit()
    return await get_service(service_id, clinic_id, session)


async def delete_service(service_id: str, clinic_id: str, session: AsyncSession) -> None:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text("UPDATE appointment_services SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        {"id": service_id},
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Servicio no encontrado")
    await session.commit()


# ---- appointments ----

async def list_appointments(
    clinic_id: str,
    session: AsyncSession,
    appointment_status: str | None = None,
    service_type: str | None = None,
    patient_id: str | None = None,
    assigned_user_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    only_own_clerk_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[AppointmentRead]:
    await set_rls_context(session, clinic_id)

    filters = ""
    params: dict = {"limit": limit, "offset": offset}

    if appointment_status:
        filters += " AND a.status = :appointment_status"
        params["appointment_status"] = appointment_status
    if service_type:
        filters += " AND a.service_type = :service_type"
        params["service_type"] = service_type
    if patient_id:
        filters += " AND a.patient_id = :patient_id"
        params["patient_id"] = patient_id
    if assigned_user_id:
        filters += " AND a.assigned_user_id = :assigned_user_id"
        params["assigned_user_id"] = assigned_user_id
    if date_from:
        filters += " AND a.scheduled_at >= :date_from"
        params["date_from"] = date_from
    if date_to:
        filters += " AND a.scheduled_at <= :date_to"
        params["date_to"] = date_to
    if only_own_clerk_id:
        filters += (
            " AND a.assigned_user_id = ("
            "SELECT id FROM users WHERE clerk_user_id = :only_own_clerk_id AND deleted_at IS NULL LIMIT 1)"
        )
        params["only_own_clerk_id"] = only_own_clerk_id

    result = await session.execute(
        text(f"{_APPOINTMENT_SELECT}{filters} ORDER BY a.scheduled_at LIMIT :limit OFFSET :offset"),
        params,
    )
    return [AppointmentRead(**row) for row in result.mappings()]


async def get_appointment(appointment_id: str, clinic_id: str, session: AsyncSession) -> AppointmentRead:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text(f"{_APPOINTMENT_SELECT} AND a.id = :id"),
        {"id": appointment_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
    return AppointmentRead(**row)


async def create_appointment(clinic_id: str, data: AppointmentCreate, session: AsyncSession) -> AppointmentRead:
    await set_rls_context(session, clinic_id)

    checks = [
        ("SELECT 1 FROM patients WHERE id = :id AND deleted_at IS NULL", data.patient_id, "Paciente no encontrado"),
        ("SELECT 1 FROM owners WHERE id = :id AND deleted_at IS NULL", data.owner_id, "Propietario no encontrado"),
        ("SELECT 1 FROM users WHERE id = :id AND deleted_at IS NULL", data.assigned_user_id, "Usuario no encontrado"),
        ("SELECT 1 FROM appointment_services WHERE id = :id AND deleted_at IS NULL", data.service_id, "Servicio no encontrado"),
    ]
    for query, fk_id, msg in checks:
        check = await session.execute(text(query), {"id": fk_id})
        if check.scalar() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

    svc_row = await session.execute(
        text("SELECT service_type FROM appointment_services WHERE id = :id"),
        {"id": data.service_id},
    )
    service_type = svc_row.scalar_one()

    result = await session.execute(
        text("""
            INSERT INTO appointments
                (clinic_id, patient_id, owner_id, assigned_user_id, service_id,
                 service_type, scheduled_at, notes)
            VALUES
                (:clinic_id, :patient_id, :owner_id, :assigned_user_id, :service_id,
                 :service_type, :scheduled_at, :notes)
            RETURNING id
        """),
        {"clinic_id": clinic_id, "service_type": service_type, **data.model_dump()},
    )
    appointment_id = str(result.scalar_one())
    await session.commit()
    return await get_appointment(appointment_id, clinic_id, session)


async def update_appointment(
    appointment_id: str, clinic_id: str, data: AppointmentUpdate, session: AsyncSession
) -> AppointmentRead:
    await set_rls_context(session, clinic_id)
    fields = data.model_dump(exclude_unset=True)
    if not fields:
        return await get_appointment(appointment_id, clinic_id, session)

    if "service_id" in fields:
        svc_row = await session.execute(
            text("SELECT service_type FROM appointment_services WHERE id = :id AND deleted_at IS NULL"),
            {"id": fields["service_id"]},
        )
        svc_type = svc_row.scalar()
        if svc_type is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Servicio no encontrado")
        fields["service_type"] = svc_type

    if "assigned_user_id" in fields:
        check = await session.execute(
            text("SELECT 1 FROM users WHERE id = :id AND deleted_at IS NULL"),
            {"id": fields["assigned_user_id"]},
        )
        if check.scalar() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["id"] = appointment_id
    result = await session.execute(
        text(f"UPDATE appointments SET {set_clause} WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        fields,
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
    await session.commit()
    return await get_appointment(appointment_id, clinic_id, session)


async def cancel_appointment(appointment_id: str, clinic_id: str, session: AsyncSession) -> None:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text("UPDATE appointments SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        {"id": appointment_id},
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
    await session.commit()
