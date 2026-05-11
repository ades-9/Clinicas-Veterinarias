from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, model_validator

SaleStatus = Literal["pending", "completed", "cancelled"]


class SaleItemCreate(BaseModel):
    product_id: str | None = None
    service_id: str | None = None
    quantity: Decimal
    unit_price: Decimal
    # Profesional que prestó el servicio o que vendió el producto.
    # Para servicios derivados de una atención, se asigna automáticamente.
    professional_user_id: str | None = None

    @model_validator(mode="after")
    def check_one_type(self) -> "SaleItemCreate":
        if (self.product_id is None) == (self.service_id is None):
            raise ValueError("Cada ítem debe tener product_id O service_id, no ambos ni ninguno")
        return self


class SaleItemRead(BaseModel):
    id: UUID
    clinic_id: UUID
    sale_id: UUID
    product_id: UUID | None
    service_id: UUID | None
    item_name: str
    quantity: Decimal
    unit_price: Decimal
    subtotal: Decimal
    professional_user_id: UUID | None
    professional_name: str | None


class SaleCreate(BaseModel):
    appointment_id: str | None = None
    patient_id: str | None = None
    owner_id: str | None = None
    notes: str | None = None
    items: list[SaleItemCreate]


class SaleUpdate(BaseModel):
    """Edición de una venta pendiente: reemplaza items y/o notas."""
    notes: str | None = None
    items: list[SaleItemCreate] | None = None


class SaleRead(BaseModel):
    id: UUID
    clinic_id: UUID
    user_id: UUID | None
    appointment_id: UUID | None
    patient_id: UUID | None
    patient_name: str | None
    owner_id: UUID | None
    owner_name: str | None
    status: SaleStatus
    total: Decimal
    notes: str | None
    created_at: datetime
    items: list[SaleItemRead]
