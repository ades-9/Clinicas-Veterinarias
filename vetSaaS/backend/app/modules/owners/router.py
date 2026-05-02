from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.core.permissions import require_permission
from app.modules.owners import crud
from app.modules.owners.schemas import OwnerCreate, OwnerRead, OwnerUpdate

router = APIRouter(prefix="/owners", tags=["owners"])


@router.get("", response_model=list[OwnerRead])
async def list_owners(
    q: str | None = Query(default=None, description="Buscar por nombre, email, teléfono o documento"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = require_permission("owners.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.list_owners(user.clinic_id, session, q=q, limit=limit, offset=offset)


@router.get("/{owner_id}", response_model=OwnerRead)
async def get_owner(
    owner_id: str,
    user: CurrentUser = require_permission("owners.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.get_owner(owner_id, user.clinic_id, session)


@router.post("", response_model=OwnerRead, status_code=status.HTTP_201_CREATED)
async def create_owner(
    data: OwnerCreate,
    user: CurrentUser = require_permission("owners.create"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.create_owner(user.clinic_id, data, session)


@router.patch("/{owner_id}", response_model=OwnerRead)
async def update_owner(
    owner_id: str,
    data: OwnerUpdate,
    user: CurrentUser = require_permission("owners.edit"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.update_owner(owner_id, user.clinic_id, data, session)


@router.delete("/{owner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_owner(
    owner_id: str,
    user: CurrentUser = require_permission("owners.edit"),
    session: AsyncSession = Depends(get_db),
):
    await crud.delete_owner(owner_id, user.clinic_id, session)
