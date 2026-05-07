from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class SaleItemCreate(BaseModel):
    product_id: str
    quantity: Decimal
    unit_price: Decimal


class SaleItemRead(BaseModel):
    id: UUID
    clinic_id: UUID
    sale_id: UUID
    product_id: UUID
    product_name: str
    quantity: Decimal
    unit_price: Decimal
    subtotal: Decimal


class SaleCreate(BaseModel):
    patient_id: str | None = None
    owner_id: str | None = None
    notes: str | None = None
    items: list[SaleItemCreate]


class SaleRead(BaseModel):
    id: UUID
    clinic_id: UUID
    user_id: UUID | None
    patient_id: UUID | None
    patient_name: str | None
    owner_id: UUID | None
    owner_name: str | None
    total: Decimal
    notes: str | None
    created_at: datetime
    items: list[SaleItemRead]
