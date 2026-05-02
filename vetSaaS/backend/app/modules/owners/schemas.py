from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class OwnerRead(BaseModel):
    id: UUID
    clinic_id: UUID
    full_name: str
    id_number: str | None
    phone: str | None
    email: str | None
    address: str | None
    created_at: datetime


class OwnerCreate(BaseModel):
    full_name: str
    id_number: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None


class OwnerUpdate(BaseModel):
    full_name: str | None = None
    id_number: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
