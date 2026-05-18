from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.core.validators import validate_ecuador_id, validate_phone_ec

PreferredContact = Literal["whatsapp", "sms", "email", "phone"]


class OwnerRead(BaseModel):
    id: UUID
    clinic_id: UUID
    full_name: str
    id_number: str | None
    phone: str | None
    email: str | None
    address: str | None
    preferred_contact: PreferredContact | None
    created_at: datetime


class OwnersList(BaseModel):
    items: list[OwnerRead]
    total: int


class OwnerCreate(BaseModel):
    full_name: str
    id_number: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    preferred_contact: PreferredContact | None = None

    @field_validator("id_number")
    @classmethod
    def _check_id_number(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        return validate_ecuador_id(v)

    @field_validator("phone")
    @classmethod
    def _check_phone(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        return validate_phone_ec(v)


class OwnerUpdate(BaseModel):
    full_name: str | None = None
    id_number: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    preferred_contact: PreferredContact | None = None

    @field_validator("id_number")
    @classmethod
    def _check_id_number(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        return validate_ecuador_id(v)

    @field_validator("phone")
    @classmethod
    def _check_phone(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        return validate_phone_ec(v)
