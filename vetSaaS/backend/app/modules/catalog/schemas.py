from uuid import UUID
from pydantic import BaseModel


class SpeciesRead(BaseModel):
    id: UUID
    name: str


class BreedRead(BaseModel):
    id: UUID
    species_id: UUID
    name: str


class ProductUnitRead(BaseModel):
    id: UUID
    name: str


class VaccineTypeRead(BaseModel):
    id: UUID
    name: str
    species_id: UUID | None
    description: str | None
    recommended_revaccination_months: int | None
