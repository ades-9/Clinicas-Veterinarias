from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.core.permissions import require_permission
from app.modules.users import crud
from app.modules.users.schemas import RoleRead, UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])
roles_router = APIRouter(prefix="/roles", tags=["users"])


@router.get("", response_model=list[UserRead])
async def list_users(
    user: CurrentUser = require_permission("users.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.list_users(user.clinic_id, session)


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: str,
    user: CurrentUser = require_permission("users.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.get_user(user_id, user.clinic_id, session)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    user: CurrentUser = require_permission("users.create"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.create_user(user.clinic_id, data, session)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: str,
    data: UserUpdate,
    user: CurrentUser = require_permission("users.edit"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.update_user(user_id, user.clinic_id, data, session)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: str,
    user: CurrentUser = require_permission("users.deactivate"),
    session: AsyncSession = Depends(get_db),
):
    await crud.deactivate_user(user_id, user.clinic_id, user.user_id, session)


@roles_router.get("", response_model=list[RoleRead])
async def list_roles(
    user: CurrentUser = require_permission("users.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.list_roles(user.clinic_id, session)
