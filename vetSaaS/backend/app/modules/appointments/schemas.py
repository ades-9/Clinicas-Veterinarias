from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

ServiceType = Literal["veterinary", "grooming", "aesthetic"]
AppointmentStatus = Literal["pending", "confirmed", "attended", "cancelled"]


class AppointmentServiceRead(BaseModel):
    id: UUID
    clinic_id: UUID
    name: str
    service_type: ServiceType
    duration_minutes: int
    price: float
    promo_price: float | None
    promo_start: date | None
    promo_end: date | None
    effective_price: float
    is_promotional: bool
    created_at: datetime


class AppointmentServiceCreate(BaseModel):
    name: str
    service_type: ServiceType
    duration_minutes: int = 30
    price: float = 0.0
    promo_price: float | None = None
    promo_start: date | None = None
    promo_end: date | None = None
    is_promotional: bool = False


class AppointmentServiceUpdate(BaseModel):
    name: str | None = None
    service_type: ServiceType | None = None
    duration_minutes: int | None = None
    price: float | None = None
    promo_price: float | None = None
    promo_start: date | None = None
    promo_end: date | None = None
    is_promotional: bool | None = None


class AppointmentRead(BaseModel):
    id: UUID
    clinic_id: UUID
    patient_id: UUID
    patient_name: str
    owner_id: UUID
    owner_name: str
    assigned_user_id: UUID
    assigned_user_name: str
    service_type: ServiceType  # área (común a todos los servicios de la cita)
    services: list[AppointmentServiceRead] = []
    total_duration_minutes: int = 0
    scheduled_at: datetime
    status: AppointmentStatus
    notes: str | None
    is_emergency: bool = False
    created_at: datetime


class AppointmentCreate(BaseModel):
    patient_id: str
    owner_id: str
    assigned_user_id: str
    service_ids: list[str]
    scheduled_at: datetime
    notes: str | None = None
    is_emergency: bool = False


class AppointmentUpdate(BaseModel):
    assigned_user_id: str | None = None
    service_ids: list[str] | None = None
    scheduled_at: datetime | None = None
    status: AppointmentStatus | None = None
    notes: str | None = None
