from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_rls_context
from app.modules.products.schemas import (
    ProductCategoryCreate,
    ProductCategoryRead,
    ProductCategoryUpdate,
    ProductCreate,
    ProductRead,
    ProductsList,
    ProductUpdate,
    StockMovementCreate,
    StockMovementRead,
    StockMovementsList,
)

_CATEGORY_SELECT = "SELECT id, clinic_id, name, created_at FROM product_categories WHERE deleted_at IS NULL"

_PRODUCT_SELECT = """
    SELECT p.id, p.clinic_id, p.category_id, c.name AS category_name,
           p.name, p.description, p.sku, p.unit, p.price, p.cost,
           p.stock, p.min_stock, p.is_active, p.is_medication, p.created_at
    FROM products p
    LEFT JOIN product_categories c ON c.id = p.category_id AND c.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
"""

_MOVEMENT_SELECT = """
    SELECT sm.id, sm.clinic_id, sm.product_id, p.name AS product_name,
           sm.user_id, sm.movement_type, sm.quantity, sm.reason, sm.created_at
    FROM stock_movements sm
    JOIN products p ON p.id = sm.product_id
"""


# ---- categories ----

async def list_categories(clinic_id: str, session: AsyncSession) -> list[ProductCategoryRead]:
    await set_rls_context(session, clinic_id)
    result = await session.execute(text(f"{_CATEGORY_SELECT} ORDER BY name"))
    return [ProductCategoryRead(**row) for row in result.mappings()]


async def get_category(category_id: str, clinic_id: str, session: AsyncSession) -> ProductCategoryRead:
    await set_rls_context(session, clinic_id)
    result = await session.execute(text(f"{_CATEGORY_SELECT} AND id = :id"), {"id": category_id})
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")
    return ProductCategoryRead(**row)


async def create_category(clinic_id: str, data: ProductCategoryCreate, session: AsyncSession) -> ProductCategoryRead:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text("INSERT INTO product_categories (clinic_id, name) VALUES (:clinic_id, :name) RETURNING id"),
        {"clinic_id": clinic_id, "name": data.name},
    )
    cat_id = str(result.scalar_one())
    await session.commit()
    return await get_category(cat_id, clinic_id, session)


async def update_category(
    category_id: str, clinic_id: str, data: ProductCategoryUpdate, session: AsyncSession
) -> ProductCategoryRead:
    await set_rls_context(session, clinic_id)
    fields = data.model_dump(exclude_unset=True)
    if not fields:
        return await get_category(category_id, clinic_id, session)
    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["id"] = category_id
    result = await session.execute(
        text(f"UPDATE product_categories SET {set_clause} WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        fields,
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")
    await session.commit()
    return await get_category(category_id, clinic_id, session)


async def delete_category(category_id: str, clinic_id: str, session: AsyncSession) -> None:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text("UPDATE product_categories SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        {"id": category_id},
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")
    await session.commit()


# ---- products ----

async def list_products(
    clinic_id: str,
    session: AsyncSession,
    search: str | None = None,
    category_id: str | None = None,
    low_stock: bool = False,
    is_active: bool | None = None,
    in_stock: bool = False,
    is_medication: bool | None = None,
    limit: int = 50,
    offset: int = 0,
) -> ProductsList:
    await set_rls_context(session, clinic_id)
    filters = ""
    params: dict = {"limit": limit, "offset": offset}
    count_params: dict = {}
    if search:
        clause = (
            " AND (LOWER(p.name) LIKE :search"
            " OR LOWER(COALESCE(p.sku, '')) LIKE :search"
            " OR LOWER(COALESCE(c.name, '')) LIKE :search)"
        )
        filters += clause
        params["search"] = f"%{search.lower()}%"
        count_params["search"] = params["search"]
    if category_id:
        filters += " AND p.category_id = :category_id"
        params["category_id"] = category_id
        count_params["category_id"] = category_id
    if low_stock:
        filters += " AND p.stock <= p.min_stock"
    if is_active is not None:
        filters += " AND p.is_active = :is_active"
        params["is_active"] = is_active
        count_params["is_active"] = is_active
    if in_stock:
        filters += " AND p.stock > 0"
    if is_medication is not None:
        filters += " AND p.is_medication = :is_medication"
        params["is_medication"] = is_medication
        count_params["is_medication"] = is_medication

    items_result = await session.execute(
        text(f"{_PRODUCT_SELECT}{filters} ORDER BY p.name LIMIT :limit OFFSET :offset"),
        params,
    )
    items = [ProductRead(**row) for row in items_result.mappings()]

    count_sql = (
        "SELECT COUNT(*) FROM products p "
        "LEFT JOIN product_categories c ON c.id = p.category_id AND c.deleted_at IS NULL "
        "WHERE p.deleted_at IS NULL" + filters
    )
    total = (await session.execute(text(count_sql), count_params)).scalar() or 0
    return ProductsList(items=items, total=total)


async def get_product(product_id: str, clinic_id: str, session: AsyncSession) -> ProductRead:
    await set_rls_context(session, clinic_id)
    result = await session.execute(text(f"{_PRODUCT_SELECT} AND p.id = :id"), {"id": product_id})
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return ProductRead(**row)


async def create_product(clinic_id: str, data: ProductCreate, session: AsyncSession) -> ProductRead:
    await set_rls_context(session, clinic_id)
    if data.category_id:
        check = await session.execute(
            text("SELECT 1 FROM product_categories WHERE id = :id AND deleted_at IS NULL"),
            {"id": data.category_id},
        )
        if check.scalar() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")
    result = await session.execute(
        text("""
            INSERT INTO products
                (clinic_id, category_id, name, description, sku, unit, price, cost, min_stock, is_medication)
            VALUES
                (:clinic_id, :category_id, :name, :description, :sku, :unit, :price, :cost, :min_stock, :is_medication)
            RETURNING id
        """),
        {"clinic_id": clinic_id, **data.model_dump()},
    )
    product_id = str(result.scalar_one())
    await session.commit()
    return await get_product(product_id, clinic_id, session)


async def update_product(
    product_id: str, clinic_id: str, data: ProductUpdate, session: AsyncSession
) -> ProductRead:
    await set_rls_context(session, clinic_id)
    fields = data.model_dump(exclude_unset=True)
    if not fields:
        return await get_product(product_id, clinic_id, session)
    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["id"] = product_id
    result = await session.execute(
        text(f"UPDATE products SET {set_clause} WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        fields,
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    await session.commit()
    return await get_product(product_id, clinic_id, session)


async def delete_product(product_id: str, clinic_id: str, session: AsyncSession) -> None:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text("UPDATE products SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        {"id": product_id},
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    await session.commit()


# ---- stock movements ----

async def list_stock_movements(
    clinic_id: str,
    session: AsyncSession,
    product_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> StockMovementsList:
    await set_rls_context(session, clinic_id)
    filters = ""
    params: dict = {"limit": limit, "offset": offset}
    count_params: dict = {}
    if product_id:
        filters = " AND sm.product_id = :product_id"
        params["product_id"] = product_id
        count_params["product_id"] = product_id
    items_result = await session.execute(
        text(f"{_MOVEMENT_SELECT} WHERE TRUE{filters} ORDER BY sm.created_at DESC LIMIT :limit OFFSET :offset"),
        params,
    )
    items = [StockMovementRead(**row) for row in items_result.mappings()]
    count_sql = "SELECT COUNT(*) FROM stock_movements sm WHERE TRUE" + filters
    total = (await session.execute(text(count_sql), count_params)).scalar() or 0
    return StockMovementsList(items=items, total=total)


async def create_stock_movement(
    clinic_id: str, clerk_user_id: str, data: StockMovementCreate, session: AsyncSession
) -> StockMovementRead:
    await set_rls_context(session, clinic_id)

    stock_row = await session.execute(
        text("SELECT id, stock FROM products WHERE id = :id AND deleted_at IS NULL"),
        {"id": data.product_id},
    )
    product = stock_row.mappings().first()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    user_row = await session.execute(
        text("SELECT id FROM users WHERE clerk_user_id = :clerk_id AND deleted_at IS NULL LIMIT 1"),
        {"clerk_id": clerk_user_id},
    )
    db_user_id = user_row.scalar()

    delta = data.quantity if data.movement_type == "entry" else -data.quantity
    new_stock = Decimal(str(product["stock"])) + delta
    if new_stock < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stock insuficiente")

    result = await session.execute(
        text("""
            INSERT INTO stock_movements (clinic_id, product_id, user_id, movement_type, quantity, reason)
            VALUES (:clinic_id, :product_id, :user_id, :movement_type, :quantity, :reason)
            RETURNING id
        """),
        {
            "clinic_id": clinic_id,
            "user_id": str(db_user_id) if db_user_id else None,
            "product_id": data.product_id,
            "movement_type": data.movement_type,
            "quantity": data.quantity,
            "reason": data.reason,
        },
    )
    movement_id = str(result.scalar_one())

    await session.execute(
        text("UPDATE products SET stock = stock + :delta WHERE id = :id"),
        {"delta": delta, "id": data.product_id},
    )
    await session.commit()

    row = await session.execute(
        text(f"{_MOVEMENT_SELECT} WHERE sm.id = :id"),
        {"id": movement_id},
    )
    return StockMovementRead(**row.mappings().first())
