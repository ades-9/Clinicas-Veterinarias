from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.core.permissions import require_permission
from app.modules.sales import crud
from app.modules.sales.schemas import SaleCreate, SaleRead, SalesList, SaleUpdate

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("", response_model=SalesList)
async def list_sales(
    patient_id: str | None = Query(default=None),
    owner_id: str | None = Query(default=None),
    sale_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = require_permission("sales.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.list_sales(
        user.clinic_id, session,
        patient_id=patient_id, owner_id=owner_id, sale_status=sale_status,
        limit=limit, offset=offset,
    )


@router.get("/{sale_id}", response_model=SaleRead)
async def get_sale(
    sale_id: str,
    user: CurrentUser = require_permission("sales.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.get_sale(sale_id, user.clinic_id, session)


@router.post("", response_model=SaleRead, status_code=http_status.HTTP_201_CREATED)
async def create_sale(
    data: SaleCreate,
    user: CurrentUser = require_permission("sales.create"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.create_sale(user.clinic_id, user.user_id, data, session)


@router.patch("/{sale_id}", response_model=SaleRead)
async def update_sale(
    sale_id: str,
    data: SaleUpdate,
    user: CurrentUser = require_permission("sales.create"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.update_sale(sale_id, user.clinic_id, data, session)


@router.post("/{sale_id}/finalize", response_model=SaleRead)
async def finalize_sale(
    sale_id: str,
    user: CurrentUser = require_permission("sales.create"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.finalize_sale(sale_id, user.clinic_id, user.user_id, session)


@router.post("/{sale_id}/cancel", status_code=http_status.HTTP_204_NO_CONTENT)
async def cancel_sale(
    sale_id: str,
    user: CurrentUser = require_permission("sales.cancel"),
    session: AsyncSession = Depends(get_db),
):
    await crud.cancel_sale(sale_id, user.clinic_id, session)


@router.delete("/{sale_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_sale(
    sale_id: str,
    user: CurrentUser = require_permission("sales.cancel"),
    session: AsyncSession = Depends(get_db),
):
    await crud.delete_sale(sale_id, user.clinic_id, session)
