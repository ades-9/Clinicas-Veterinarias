from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

UserArea = Literal["veterinary", "grooming", "aesthetic"]


class RoleRead(BaseModel):
    id: UUID
    name: str


class UserRead(BaseModel):
    id: UUID
    clinic_id: UUID
    role_id: UUID
    role_name: str
    clerk_user_id: str
    full_name: str
    email: str
    is_active: bool
    areas: list[UserArea] = []
    created_at: datetime


class UserCreate(BaseModel):
    full_name: str
    email: str
    role_id: str
    areas: list[UserArea] = []


class UserUpdate(BaseModel):
    full_name: str | None = None
    role_id: str | None = None
    areas: list[UserArea] | None = None


class UserCreateResponse(BaseModel):
    """Respuesta al crear usuario. Devuelve la password temporal una sola vez para que el admin
    pueda compartirla con el invitado (Clerk no envía email automático sin webhooks)."""
    user: UserRead
    temporary_password: str
