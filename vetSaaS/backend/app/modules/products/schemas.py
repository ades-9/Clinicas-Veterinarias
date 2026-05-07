from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

MovementType = Literal["entry", "exit", "adjustment"]


class ProductCategoryRead(BaseModel):
    id: UUID
    clinic_id: UUID
    name: str
    created_at: datetime


class ProductCategoryCreate(BaseModel):
    name: str


class ProductCategoryUpdate(BaseModel):
    name: str | None = None


class ProductRead(BaseModel):
    id: UUID
    clinic_id: UUID
    category_id: UUID | None
    category_name: str | None
    name: str
    description: str | None
    sku: str | None
    unit: str
    price: Decimal
    cost: Decimal | None
    stock: Decimal
    min_stock: Decimal
    is_active: bool
    created_at: datetime


class ProductCreate(BaseModel):
    category_id: str | None = None
    name: str
    description: str | None = None
    sku: str | None = None
    unit: str = "unidad"
    price: Decimal
    cost: Decimal | None = None
    min_stock: Decimal = Decimal("0")


class ProductUpdate(BaseModel):
    category_id: str | None = None
    name: str | None = None
    description: str | None = None
    sku: str | None = None
    unit: str | None = None
    price: Decimal | None = None
    cost: Decimal | None = None
    min_stock: Decimal | None = None
    is_active: bool | None = None


class StockMovementRead(BaseModel):
    id: UUID
    clinic_id: UUID
    product_id: UUID
    product_name: str
    user_id: UUID | None
    movement_type: MovementType
    quantity: Decimal
    reason: str | None
    created_at: datetime


class StockMovementCreate(BaseModel):
    product_id: str
    movement_type: MovementType
    quantity: Decimal
    reason: str | None = None
