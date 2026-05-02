from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ClinicRead(BaseModel):
    id: UUID
    name: str
    phone: str | None
    address: str | None
    email: str | None
    tax_id: str | None
    logo_url: str | None
    is_active: bool
    created_at: datetime


class ClinicUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    address: str | None = None
    email: str | None = None
    tax_id: str | None = None