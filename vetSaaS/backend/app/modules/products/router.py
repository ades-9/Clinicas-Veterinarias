from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.core.permissions import require_permission
from app.modules.products import crud
from app.modules.products.schemas import (
    ProductCategoryCreate,
    ProductCategoryRead,
    ProductCategoryUpdate,
    ProductCreate,
    ProductRead,
    ProductUpdate,
    StockMovementCreate,
    StockMovementRead,
)

categories_router = APIRouter(prefix="/product-categories", tags=["inventory"])
router = APIRouter(prefix="/products", tags=["inventory"])
movements_router = APIRouter(prefix="/stock-movements", tags=["inventory"])


# ---- categories ----

@categories_router.get("", response_model=list[ProductCategoryRead])
async def list_categories(
    user: CurrentUser = require_permission("products.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.list_categories(user.clinic_id, session)


@categories_router.post("", response_model=ProductCategoryRead, status_code=http_status.HTTP_201_CREATED)
async def create_category(
    data: ProductCategoryCreate,
    user: CurrentUser = require_permission("products.manage"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.create_category(user.clinic_id, data, session)


@categories_router.patch("/{category_id}", response_model=ProductCategoryRead)
async def update_category(
    category_id: str,
    data: ProductCategoryUpdate,
    user: CurrentUser = require_permission("products.manage"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.update_category(category_id, user.clinic_id, data, session)


@categories_router.delete("/{category_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    user: CurrentUser = require_permission("products.manage"),
    session: AsyncSession = Depends(get_db),
):
    await crud.delete_category(category_id, user.clinic_id, session)


# ---- products ----

@router.get("", response_model=list[ProductRead])
async def list_products(
    q: str | None = Query(default=None),
    category_id: str | None = Query(default=None),
    low_stock: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = require_permission("products.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.list_products(
        user.clinic_id, session, search=q, category_id=category_id, low_stock=low_stock, limit=limit, offset=offset
    )


@router.get("/{product_id}", response_model=ProductRead)
async def get_product(
    product_id: str,
    user: CurrentUser = require_permission("products.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.get_product(product_id, user.clinic_id, session)


@router.post("", response_model=ProductRead, status_code=http_status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    user: CurrentUser = require_permission("products.manage"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.create_product(user.clinic_id, data, session)


@router.patch("/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: str,
    data: ProductUpdate,
    user: CurrentUser = require_permission("products.manage"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.update_product(product_id, user.clinic_id, data, session)


@router.delete("/{product_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    user: CurrentUser = require_permission("products.manage"),
    session: AsyncSession = Depends(get_db),
):
    await crud.delete_product(product_id, user.clinic_id, session)


# ---- stock movements ----

@movements_router.get("", response_model=list[StockMovementRead])
async def list_stock_movements(
    product_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = require_permission("products.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.list_stock_movements(user.clinic_id, session, product_id=product_id, limit=limit, offset=offset)


@movements_router.post("", response_model=StockMovementRead, status_code=http_status.HTTP_201_CREATED)
async def create_stock_movement(
    data: StockMovementCreate,
    user: CurrentUser = require_permission("products.manage"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.create_stock_movement(user.clinic_id, user.user_id, data, session)
