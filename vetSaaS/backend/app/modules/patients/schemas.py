from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, field_validator

PatientSex = Literal["male", "female"]


def _validate_birth_date(v: date | None) -> date | None:
    if v is not None and v > date.today():
        raise ValueError("La fecha de nacimiento no puede ser futura")
    return v


def _validate_weight(v: Decimal | None) -> Decimal | None:
    if v is None:
        return None
    if v <= 0:
        raise ValueError("El peso debe ser mayor a 0")
    if v > 500:
        raise ValueError("El peso parece inválido (mayor a 500 kg)")
    return v


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
    photo_url: str | None
    notes: str | None
    created_at: datetime


class PatientsList(BaseModel):
    items: list[PatientRead]
    total: int


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

    _check_birth = field_validator("birth_date")(_validate_birth_date)
    _check_weight = field_validator("weight")(_validate_weight)


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

    _check_birth = field_validator("birth_date")(_validate_birth_date)
    _check_weight = field_validator("weight")(_validate_weight)
