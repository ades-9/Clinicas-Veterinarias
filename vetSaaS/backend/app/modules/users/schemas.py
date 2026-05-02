from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


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
    created_at: datetime


class UserCreate(BaseModel):
    full_name: str
    email: str
    role_id: str


class UserUpdate(BaseModel):
    full_name: str | None = None
    role_id: str | None = None
