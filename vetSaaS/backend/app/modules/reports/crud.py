from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_rls_context
from app.modules.reports.schemas import ProfessionalMetrics, ProfessionalPerformanceReport


_QUERY = """
    WITH appts AS (
        SELECT a.assigned_user_id AS user_id,
               COUNT(*) FILTER (WHERE a.status = 'attended')  AS attended,
               COUNT(*) FILTER (WHERE a.status = 'cancelled') AS cancelled_
        FROM appointments a
        WHERE a.deleted_at IS NULL
          AND a.scheduled_at >= :date_from
          AND a.scheduled_at < (:date_to::date + INTERVAL '1 day')
        GROUP BY a.assigned_user_id
    ),
    consults AS (
        SELECT mr.veterinarian_id AS user_id,
               COUNT(*) AS n
        FROM medical_records mr
        WHERE mr.deleted_at IS NULL
          AND mr.visit_date >= :date_from
          AND mr.visit_date < (:date_to::date + INTERVAL '1 day')
        GROUP BY mr.veterinarian_id
    ),
    items AS (
        SELECT si.professional_user_id AS user_id,
               COUNT(*) FILTER (WHERE si.service_id IS NOT NULL) AS services_sold,
               COUNT(*) FILTER (WHERE si.product_id IS NOT NULL) AS products_sold,
               COALESCE(SUM(si.subtotal), 0) AS revenue_total,
               COALESCE(SUM(si.subtotal) FILTER (
                   WHERE svc.service_type = 'veterinary'
               ), 0) AS revenue_vet,
               COALESCE(SUM(si.subtotal) FILTER (
                   WHERE svc.service_type = 'grooming'
               ), 0) AS revenue_grooming,
               COALESCE(SUM(si.subtotal) FILTER (
                   WHERE svc.service_type = 'aesthetic'
               ), 0) AS revenue_aesthetic
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        LEFT JOIN appointment_services svc ON svc.id = si.service_id
        WHERE s.deleted_at IS NULL
          AND s.status = 'completed'
          AND s.created_at >= :date_from
          AND s.created_at < (:date_to::date + INTERVAL '1 day')
          AND si.professional_user_id IS NOT NULL
        GROUP BY si.professional_user_id
    )
    SELECT u.id AS user_id,
           u.full_name,
           r.name AS role_name,
           COALESCE(appts.attended, 0)::int AS appointments_attended,
           COALESCE(appts.cancelled_, 0)::int AS appointments_cancelled,
           COALESCE(consults.n, 0)::int AS consultations_count,
           COALESCE(items.services_sold, 0)::int AS services_sold,
           COALESCE(items.products_sold, 0)::int AS products_sold,
           COALESCE(items.revenue_total, 0) AS revenue_total,
           COALESCE(items.revenue_vet, 0) AS revenue_veterinary,
           COALESCE(items.revenue_grooming, 0) AS revenue_grooming,
           COALESCE(items.revenue_aesthetic, 0) AS revenue_aesthetic
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN appts ON appts.user_id = u.id
    LEFT JOIN consults ON consults.user_id = u.id
    LEFT JOIN items ON items.user_id = u.id
    WHERE u.deleted_at IS NULL AND u.is_active = TRUE
      AND (appts.user_id IS NOT NULL
           OR consults.user_id IS NOT NULL
           OR items.user_id IS NOT NULL)
    ORDER BY revenue_total DESC, u.full_name
"""


async def professional_performance(
    clinic_id: str, session: AsyncSession, date_from: date, date_to: date
) -> ProfessionalPerformanceReport:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text(_QUERY),
        {"date_from": date_from, "date_to": date_to},
    )
    professionals = [ProfessionalMetrics(**row) for row in result.mappings()]
    return ProfessionalPerformanceReport(
        date_from=date_from.isoformat(),
        date_to=date_to.isoformat(),
        professionals=professionals,
    )
