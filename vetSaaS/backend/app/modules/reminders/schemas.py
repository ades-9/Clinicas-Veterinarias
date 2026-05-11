from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

ReminderKind = Literal["vaccine", "deworming"]
ReminderType = Literal["appointment_24h", "vaccine_due", "deworming_due"]


class UpcomingReminderRead(BaseModel):
    kind: ReminderKind
    patient_id: UUID
    patient_name: str
    owner_id: UUID
    owner_name: str
    owner_phone: str | None
    owner_email: str | None
    owner_preferred_contact: str | None
    label: str               # nombre de la vacuna o producto
    manufacturer: str | None
    applied_at: date         # última aplicación
    next_dose_at: date
    days_from_today: int     # negativo = vencida
    last_reminded_at: datetime | None


class MarkRemindedRequest(BaseModel):
    patient_id: str
    type: ReminderType
    scheduled_at: date  # fecha de la próxima dosis a la que se refiere el contacto
