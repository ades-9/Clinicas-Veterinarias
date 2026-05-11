from datetime import datetime, timedelta
from fastapi import HTTPException, status
from sqlalchemy import bindparam, text
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
    SELECT id, clinic_id, name, service_type, duration_minutes, price,
           promo_price, promo_start, promo_end, is_promotional,
           CASE
               WHEN promo_price IS NOT NULL
                AND promo_start IS NOT NULL AND promo_end IS NOT NULL
                AND promo_start <= CURRENT_DATE AND promo_end >= CURRENT_DATE
               THEN promo_price
               ELSE price
           END AS effective_price,
           created_at
    FROM appointment_services
    WHERE deleted_at IS NULL
"""

_APPOINTMENT_SELECT = """
    SELECT a.id, a.clinic_id, a.patient_id, p.name AS patient_name,
           a.owner_id, o.full_name AS owner_name,
           a.assigned_user_id, u.full_name AS assigned_user_name,
           a.service_type, a.scheduled_at, a.status, a.notes,
           a.is_emergency, a.created_at
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN owners o ON o.id = a.owner_id
    JOIN users u ON u.id = a.assigned_user_id
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
            INSERT INTO appointment_services
                (clinic_id, name, service_type, duration_minutes, price,
                 promo_price, promo_start, promo_end, is_promotional)
            VALUES
                (:clinic_id, :name, :service_type, :duration_minutes, :price,
                 :promo_price, :promo_start, :promo_end, :is_promotional)
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

async def _auto_cancel_stale(session: AsyncSession) -> None:
    await session.execute(
        text("""
            UPDATE appointments
            SET status = 'cancelled'
            WHERE status = 'pending'
              AND scheduled_at < NOW()
              AND deleted_at IS NULL
        """)
    )
    await session.commit()


async def _validate_and_load_services(
    service_ids: list[str], session: AsyncSession
) -> list[dict]:
    """Devuelve dicts con id, name, service_type, duration_minutes para cada service.
    Lanza 400/404 si alguno no existe o si tienen distinto service_type."""
    if not service_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cita necesita al menos un servicio",
        )
    stmt = text("""
        SELECT id, name, service_type, duration_minutes
        FROM appointment_services
        WHERE id IN :ids AND deleted_at IS NULL
    """).bindparams(bindparam("ids", expanding=True))
    result = await session.execute(stmt, {"ids": service_ids})
    rows = [dict(r) for r in result.mappings()]
    if len(rows) != len(set(service_ids)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uno o más servicios no existen",
        )
    types = {r["service_type"] for r in rows}
    if len(types) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Todos los servicios de una cita deben pertenecer a la misma área",
        )
    return rows


async def _detect_conflict(
    session: AsyncSession,
    service_ids: list[str],
    assigned_user_id: str,
    scheduled_at: datetime,
    total_duration: int,
    appointment_id_to_exclude: str | None = None,
) -> dict | None:
    """Devuelve datos del primer conflicto: cita activa con un servicio en común o el mismo
    profesional, cuyo intervalo se solapa con el propuesto. None si no hay."""
    end_time = scheduled_at + timedelta(minutes=total_duration)

    sql = """
        WITH appt_durations AS (
            SELECT a.id, a.scheduled_at, a.assigned_user_id,
                   COALESCE(SUM(s.duration_minutes), 0) AS dur,
                   ARRAY_AGG(s.name) AS service_names
            FROM appointments a
            LEFT JOIN appointment_service_links l ON l.appointment_id = a.id
            LEFT JOIN appointment_services s ON s.id = l.service_id
            WHERE a.deleted_at IS NULL AND a.status != 'cancelled'
            GROUP BY a.id
        )
        SELECT ad.id, ad.scheduled_at, ad.dur, u.full_name AS assigned_name,
               ad.service_names,
               EXISTS(
                   SELECT 1 FROM appointment_service_links l2
                   WHERE l2.appointment_id = ad.id AND l2.service_id IN :new_service_ids
               ) AS service_match,
               (ad.assigned_user_id = :assigned_user_id) AS assignee_match
        FROM appt_durations ad
        JOIN users u ON u.id = ad.assigned_user_id
        WHERE ad.scheduled_at < :end_time
          AND ad.scheduled_at + (ad.dur * INTERVAL '1 minute') > :scheduled_at
          AND (
              ad.assigned_user_id = :assigned_user_id
              OR EXISTS(
                  SELECT 1 FROM appointment_service_links l3
                  WHERE l3.appointment_id = ad.id AND l3.service_id IN :new_service_ids
              )
          )
    """
    params: dict = {
        "new_service_ids": service_ids,
        "assigned_user_id": assigned_user_id,
        "scheduled_at": scheduled_at,
        "end_time": end_time,
    }
    if appointment_id_to_exclude:
        sql += " AND ad.id != :exclude_id"
        params["exclude_id"] = appointment_id_to_exclude
    sql += " LIMIT 1"

    stmt = text(sql).bindparams(bindparam("new_service_ids", expanding=True))
    result = await session.execute(stmt, params)
    row = result.mappings().first()
    return dict(row) if row else None


def _format_conflict_detail(conflict: dict) -> str:
    reasons = []
    if conflict["service_match"]:
        reasons.append("mismo servicio")
    if conflict["assignee_match"]:
        reasons.append("mismo profesional")
    when = conflict["scheduled_at"].strftime("%d/%m %H:%M")
    services = ", ".join(filter(None, conflict["service_names"] or []))
    return (
        f"Conflicto de horario ({', '.join(reasons)}): "
        f"{services or 'cita existente'} con {conflict['assigned_name']} a las {when}"
    )


async def _bulk_load_services_by_appointment(
    appointment_ids: list[str], session: AsyncSession
) -> dict[str, list[AppointmentServiceRead]]:
    """Carga los servicios de cada appointment via la link table, devolviendo un dict
    appointment_id → list[AppointmentServiceRead]."""
    if not appointment_ids:
        return {}
    stmt = text(f"""
        SELECT l.appointment_id, l.position, sub.*
        FROM appointment_service_links l
        JOIN ({_SERVICE_SELECT}) sub ON sub.id = l.service_id
        WHERE l.appointment_id IN :ids
        ORDER BY l.appointment_id, l.position
    """).bindparams(bindparam("ids", expanding=True))
    result = await session.execute(stmt, {"ids": appointment_ids})
    grouped: dict[str, list[AppointmentServiceRead]] = {}
    for row in result.mappings():
        d = dict(row)
        appt_id = str(d.pop("appointment_id"))
        d.pop("position", None)
        grouped.setdefault(appt_id, []).append(AppointmentServiceRead(**d))
    return grouped


def _build_appointment_read(row: dict, services: list[AppointmentServiceRead]) -> AppointmentRead:
    appt = AppointmentRead(**row, services=services,
                           total_duration_minutes=sum(s.duration_minutes for s in services))
    return appt


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
    await _auto_cancel_stale(session)

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
        try:
            params["date_from"] = datetime.fromisoformat(date_from)
        except ValueError:
            params["date_from"] = date_from
        filters += " AND a.scheduled_at >= :date_from"
    if date_to:
        try:
            params["date_to"] = datetime.fromisoformat(date_to)
        except ValueError:
            params["date_to"] = date_to
        filters += " AND a.scheduled_at <= :date_to"
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
    rows = [dict(r) for r in result.mappings()]
    services_by_appt = await _bulk_load_services_by_appointment(
        [str(r["id"]) for r in rows], session
    )
    return [_build_appointment_read(r, services_by_appt.get(str(r["id"]), [])) for r in rows]


async def get_appointment(appointment_id: str, clinic_id: str, session: AsyncSession) -> AppointmentRead:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text(f"{_APPOINTMENT_SELECT} AND a.id = :id"),
        {"id": appointment_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
    services_map = await _bulk_load_services_by_appointment([appointment_id], session)
    return _build_appointment_read(dict(row), services_map.get(appointment_id, []))


async def _replace_service_links(
    appointment_id: str, service_ids: list[str], session: AsyncSession
) -> None:
    """Reemplaza todos los links de servicios de una cita."""
    await session.execute(
        text("DELETE FROM appointment_service_links WHERE appointment_id = :id"),
        {"id": appointment_id},
    )
    for position, sid in enumerate(service_ids):
        await session.execute(
            text("""
                INSERT INTO appointment_service_links (appointment_id, service_id, position)
                VALUES (:appt_id, :sid, :pos)
            """),
            {"appt_id": appointment_id, "sid": sid, "pos": position},
        )


async def create_appointment(clinic_id: str, data: AppointmentCreate, session: AsyncSession) -> AppointmentRead:
    await set_rls_context(session, clinic_id)

    checks = [
        ("SELECT 1 FROM patients WHERE id = :id AND deleted_at IS NULL", data.patient_id, "Mascota no encontrada"),
        ("SELECT 1 FROM owners WHERE id = :id AND deleted_at IS NULL", data.owner_id, "Propietario no encontrado"),
        ("SELECT 1 FROM users WHERE id = :id AND deleted_at IS NULL", data.assigned_user_id, "Usuario no encontrado"),
    ]
    for query, fk_id, msg in checks:
        check = await session.execute(text(query), {"id": fk_id})
        if check.scalar() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

    # Emergencias: salteamos las validaciones de fecha pasada y conflicto.
    # El paciente entra sí o sí; el conflicto se maneja en sala.
    if not data.is_emergency:
        if data.scheduled_at < datetime.now() - timedelta(minutes=5):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pueden crear citas con fecha y hora anterior a la actual",
            )

    services = await _validate_and_load_services(data.service_ids, session)
    service_type = services[0]["service_type"]
    total_duration = sum(s["duration_minutes"] for s in services)

    if not data.is_emergency:
        conflict = await _detect_conflict(
            session,
            service_ids=data.service_ids,
            assigned_user_id=data.assigned_user_id,
            scheduled_at=data.scheduled_at,
            total_duration=total_duration,
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=_format_conflict_detail(conflict),
            )

    result = await session.execute(
        text("""
            INSERT INTO appointments
                (clinic_id, patient_id, owner_id, assigned_user_id,
                 service_type, scheduled_at, notes, is_emergency)
            VALUES
                (:clinic_id, :patient_id, :owner_id, :assigned_user_id,
                 :service_type, :scheduled_at, :notes, :is_emergency)
            RETURNING id
        """),
        {
            "clinic_id": clinic_id,
            "patient_id": data.patient_id,
            "owner_id": data.owner_id,
            "assigned_user_id": data.assigned_user_id,
            "service_type": service_type,
            "scheduled_at": data.scheduled_at,
            "notes": data.notes,
            "is_emergency": data.is_emergency,
        },
    )
    appointment_id = str(result.scalar_one())
    await _replace_service_links(appointment_id, data.service_ids, session)
    await session.commit()
    return await get_appointment(appointment_id, clinic_id, session)


async def update_appointment(
    appointment_id: str, clinic_id: str, data: AppointmentUpdate, session: AsyncSession
) -> AppointmentRead:
    await set_rls_context(session, clinic_id)
    fields = data.model_dump(exclude_unset=True)
    if not fields:
        return await get_appointment(appointment_id, clinic_id, session)

    new_service_ids = fields.pop("service_ids", None)
    new_service_type: str | None = None
    if new_service_ids is not None:
        services = await _validate_and_load_services(new_service_ids, session)
        new_service_type = services[0]["service_type"]
        fields["service_type"] = new_service_type

    if "assigned_user_id" in fields:
        check = await session.execute(
            text("SELECT 1 FROM users WHERE id = :id AND deleted_at IS NULL"),
            {"id": fields["assigned_user_id"]},
        )
        if check.scalar() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    new_status = fields.get("status")
    affects_schedule = (
        new_service_ids is not None
        or "assigned_user_id" in fields
        or "scheduled_at" in fields
    )
    if "scheduled_at" in fields and new_status != "cancelled":
        if fields["scheduled_at"] < datetime.now() - timedelta(minutes=5):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pueden agendar citas con fecha y hora anterior a la actual",
            )

    if affects_schedule and new_status != "cancelled":
        current = await get_appointment(appointment_id, clinic_id, session)
        candidate_service_ids = (
            new_service_ids if new_service_ids is not None else [str(s.id) for s in current.services]
        )
        candidate_assignee = fields.get("assigned_user_id", str(current.assigned_user_id))
        candidate_scheduled = fields.get("scheduled_at", current.scheduled_at)
        # total duration de los servicios efectivos
        durations_stmt = text("""
            SELECT COALESCE(SUM(duration_minutes), 0) AS dur
            FROM appointment_services
            WHERE id IN :ids AND deleted_at IS NULL
        """).bindparams(bindparam("ids", expanding=True))
        dur_result = await session.execute(durations_stmt, {"ids": candidate_service_ids})
        candidate_duration = int(dur_result.scalar() or 0)

        conflict = await _detect_conflict(
            session,
            service_ids=candidate_service_ids,
            assigned_user_id=candidate_assignee,
            scheduled_at=candidate_scheduled,
            total_duration=candidate_duration,
            appointment_id_to_exclude=appointment_id,
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=_format_conflict_detail(conflict),
            )

    if fields:
        set_clause = ", ".join(f"{k} = :{k}" for k in fields)
        params = {**fields, "id": appointment_id}
        result = await session.execute(
            text(f"UPDATE appointments SET {set_clause} WHERE id = :id AND deleted_at IS NULL RETURNING id"),
            params,
        )
        if result.scalar() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")

    if new_service_ids is not None:
        await _replace_service_links(appointment_id, new_service_ids, session)

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
