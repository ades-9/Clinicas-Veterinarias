from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_rls_context
from app.modules.reminders.schemas import MarkRemindedRequest, UpcomingReminderRead


_UPCOMING_SQL = """
    WITH latest_vaccines AS (
        SELECT DISTINCT ON (v.patient_id, COALESCE(v.vaccine_type_id::text, v.vaccine_name))
            v.patient_id, v.vaccine_name AS label, v.manufacturer,
            v.applied_at, v.next_dose_at
        FROM vaccinations v
        WHERE v.deleted_at IS NULL AND v.next_dose_at IS NOT NULL
        ORDER BY v.patient_id,
                 COALESCE(v.vaccine_type_id::text, v.vaccine_name),
                 v.applied_at DESC
    ),
    latest_dewormings AS (
        SELECT DISTINCT ON (d.patient_id, d.product_name, d.treatment_type)
            d.patient_id, d.product_name AS label, d.manufacturer,
            d.applied_at, d.next_dose_at
        FROM dewormings d
        WHERE d.deleted_at IS NULL AND d.next_dose_at IS NOT NULL
        ORDER BY d.patient_id, d.product_name, d.treatment_type, d.applied_at DESC
    ),
    all_upcoming AS (
        SELECT 'vaccine' AS kind, * FROM latest_vaccines
        UNION ALL
        SELECT 'deworming' AS kind, * FROM latest_dewormings
    ),
    last_reminders AS (
        SELECT patient_id, type,
               MAX(sent_at) AS last_reminded_at
        FROM reminders
        WHERE status = 'sent' AND type IN ('vaccine_due', 'deworming_due')
        GROUP BY patient_id, type
    )
    SELECT
        au.kind,
        p.id AS patient_id, p.name AS patient_name,
        o.id AS owner_id, o.full_name AS owner_name,
        o.phone AS owner_phone, o.email AS owner_email,
        o.preferred_contact AS owner_preferred_contact,
        au.label, au.manufacturer,
        au.applied_at, au.next_dose_at,
        (au.next_dose_at - CURRENT_DATE)::int AS days_from_today,
        lr.last_reminded_at
    FROM all_upcoming au
    JOIN patients p ON p.id = au.patient_id AND p.deleted_at IS NULL
    JOIN owners o ON o.id = p.owner_id AND o.deleted_at IS NULL
    LEFT JOIN last_reminders lr
        ON lr.patient_id = au.patient_id
       AND lr.type = (CASE WHEN au.kind = 'vaccine' THEN 'vaccine_due' ELSE 'deworming_due' END)
    WHERE au.next_dose_at <= (CURRENT_DATE + (:days_ahead || ' days')::interval)::date
    ORDER BY au.next_dose_at, p.name
"""


async def list_upcoming(
    clinic_id: str, session: AsyncSession, days_ahead: int = 30
) -> list[UpcomingReminderRead]:
    await set_rls_context(session, clinic_id)
    result = await session.execute(text(_UPCOMING_SQL), {"days_ahead": days_ahead})
    return [UpcomingReminderRead(**row) for row in result.mappings()]


async def mark_reminded(
    clinic_id: str, data: MarkRemindedRequest, session: AsyncSession
) -> None:
    await set_rls_context(session, clinic_id)

    # Validar patient_id existe + obtener owner_id
    patient_row = await session.execute(
        text("SELECT owner_id FROM patients WHERE id = :id AND deleted_at IS NULL"),
        {"id": data.patient_id},
    )
    row = patient_row.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mascota no encontrada")

    # Crear el reminder marcado como ya enviado (registro manual del contacto)
    await session.execute(
        text("""
            INSERT INTO reminders
                (clinic_id, patient_id, owner_id, type, scheduled_at, sent_at, status)
            VALUES
                (:clinic_id, :patient_id, :owner_id, :type, :scheduled_at, NOW(), 'sent')
        """),
        {
            "clinic_id": clinic_id,
            "patient_id": data.patient_id,
            "owner_id": str(row["owner_id"]),
            "type": data.type,
            "scheduled_at": data.scheduled_at,
        },
    )
    await session.commit()
