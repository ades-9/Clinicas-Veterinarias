from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ProfessionalMetrics(BaseModel):
    user_id: UUID
    full_name: str
    role_name: str
    # Métricas operativas
    appointments_attended: int       # citas con status='attended'
    appointments_cancelled: int      # citas con status='cancelled' (no-show + canceladas)
    consultations_count: int         # medical_records donde veterinarian_id = user_id
    # Métricas financieras (de sale_items con professional_user_id = user_id, en ventas completed)
    services_sold: int               # cantidad de líneas de servicio
    products_sold: int               # cantidad de líneas de producto vendidas por el profesional
    revenue_total: Decimal           # suma de subtotales de los items asignados
    # Desglose por área
    revenue_veterinary: Decimal
    revenue_grooming: Decimal
    revenue_aesthetic: Decimal


class ProfessionalPerformanceReport(BaseModel):
    date_from: str
    date_to: str
    professionals: list[ProfessionalMetrics]
