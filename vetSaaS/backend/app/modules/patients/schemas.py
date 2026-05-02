from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class PatientRead(BaseModel):
    id: UUID
    clinic_id: UUID
    owner_id: UUID
    owner_name: str
    name: str
    species: str | None
    breed: str | None
    birth_date: date | None
    weight: Decimal | None
    vaccination_code: str | None
    notes: str | None
    created_at: datetime


class PatientCreate(BaseModel):
    owner_id: str
    name: str
    species: str | None = None
    breed: str | None = None
    birth_date: date | None = None
    weight: Decimal | None = None
    vaccination_code: str | None = None
    notes: str | None = None


class PatientUpdate(BaseModel):
    owner_id: str | None = None
    name: str | None = None
    species: str | None = None
    breed: str | None = None
    birth_date: date | None = None
    weight: Decimal | None = None
    vaccination_code: str | None = None
    notes: str | None = None
