from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

ServiceType = Literal["veterinary", "grooming"]
AppointmentStatus = Literal["pending", "confirmed", "attended", "cancelled"]


class AppointmentServiceRead(BaseModel):
    id: UUID
    clinic_id: UUID
    name: str
    service_type: ServiceType
    duration_minutes: int
    created_at: datetime


class AppointmentServiceCreate(BaseModel):
    name: str
    service_type: ServiceType
    duration_minutes: int = 30


class AppointmentServiceUpdate(BaseModel):
    name: str | None = None
    service_type: ServiceType | None = None
    duration_minutes: int | None = None


class AppointmentRead(BaseModel):
    id: UUID
    clinic_id: UUID
    patient_id: UUID
    patient_name: str
    owner_id: UUID
    owner_name: str
    assigned_user_id: UUID
    assigned_user_name: str
    service_id: UUID
    service_name: str
    service_type: ServiceType
    scheduled_at: datetime
    status: AppointmentStatus
    notes: str | None
    created_at: datetime


class AppointmentCreate(BaseModel):
    patient_id: str
    owner_id: str
    assigned_user_id: str
    service_id: str
    scheduled_at: datetime
    notes: str | None = None


class AppointmentUpdate(BaseModel):
    assigned_user_id: str | None = None
    service_id: str | None = None
    scheduled_at: datetime | None = None
    status: AppointmentStatus | None = None
    notes: str | None = None
