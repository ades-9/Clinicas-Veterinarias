from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db
from app.core.permissions import require_permission
from app.modules.users import crud
from app.modules.users.schemas import (
    MeRead,
    PermissionCatalogItem,
    RolePermissionsRead,
    RolePermissionsUpdate,
    RoleRead,
    UserCreate,
    UserCreateResponse,
    UserRead,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])
roles_router = APIRouter(prefix="/roles", tags=["users"])
auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.get("/me", response_model=MeRead)
async def get_me(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return await crud.get_me(user.clinic_id, user.user_id, user.role, session)


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


@router.post("", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
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


@roles_router.get("/permissions/catalog", response_model=list[PermissionCatalogItem])
async def list_permissions_catalog(
    user: CurrentUser = require_permission("roles.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.list_permissions_catalog(session)


@roles_router.get("/{role_id}/permissions", response_model=RolePermissionsRead)
async def get_role_permissions(
    role_id: str,
    user: CurrentUser = require_permission("roles.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.get_role_permissions(role_id, user.clinic_id, session)


@roles_router.put("/{role_id}/permissions", response_model=RolePermissionsRead)
async def update_role_permissions(
    role_id: str,
    data: RolePermissionsUpdate,
    user: CurrentUser = require_permission("roles.edit_permissions"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.update_role_permissions(role_id, user.clinic_id, data, session)
