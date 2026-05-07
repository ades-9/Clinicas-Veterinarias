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
