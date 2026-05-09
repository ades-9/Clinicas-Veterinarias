from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

PatientSex = Literal["male", "female"]


class PatientRead(BaseModel):
    id: UUID
    clinic_id: UUID
    owner_id: UUID
    owner_name: str
    name: str
    species_id: UUID | None
    species_name: str | None
    breed_id: UUID | None
    breed_name: str | None
    birth_date: date | None
    weight: Decimal | None
    sex: PatientSex | None
    is_sterilized: bool | None
    color: str | None
    microchip_number: str | None
    distinctive_marks: str | None
    allergies: str | None
    chronic_conditions: str | None
    temperament_notes: str | None
    lifestyle_notes: str | None
    grooming_preferences: str | None
    vaccination_code: str | None
    notes: str | None
    created_at: datetime


class PatientCreate(BaseModel):
    owner_id: str
    name: str
    species_id: str | None = None
    breed_id: str | None = None
    birth_date: date | None = None
    weight: Decimal | None = None
    sex: PatientSex | None = None
    is_sterilized: bool | None = None
    color: str | None = None
    microchip_number: str | None = None
    distinctive_marks: str | None = None
    allergies: str | None = None
    chronic_conditions: str | None = None
    temperament_notes: str | None = None
    lifestyle_notes: str | None = None
    grooming_preferences: str | None = None
    vaccination_code: str | None = None
    notes: str | None = None


class PatientUpdate(BaseModel):
    owner_id: str | None = None
    name: str | None = None
    species_id: str | None = None
    breed_id: str | None = None
    birth_date: date | None = None
    weight: Decimal | None = None
    sex: PatientSex | None = None
    is_sterilized: bool | None = None
    color: str | None = None
    microchip_number: str | None = None
    distinctive_marks: str | None = None
    allergies: str | None = None
    chronic_conditions: str | None = None
    temperament_notes: str | None = None
    lifestyle_notes: str | None = None
    grooming_preferences: str | None = None
    vaccination_code: str | None = None
    notes: str | None = None
