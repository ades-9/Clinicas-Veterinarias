from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_rls_context
from app.modules.sales.schemas import SaleCreate, SaleItemRead, SaleRead

_SALE_SELECT = """
    SELECT s.id, s.clinic_id, s.user_id, s.patient_id,
           p.name AS patient_name,
           s.owner_id, o.full_name AS owner_name,
           s.total, s.notes, s.created_at
    FROM sales s
    LEFT JOIN patients p ON p.id = s.patient_id AND p.deleted_at IS NULL
    LEFT JOIN owners o ON o.id = s.owner_id AND o.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
"""

_ITEMS_SELECT = """
    SELECT si.id, si.clinic_id, si.sale_id, si.product_id,
           pr.name AS product_name, si.quantity, si.unit_price, si.subtotal
    FROM sale_items si
    JOIN products pr ON pr.id = si.product_id
    WHERE si.sale_id = :sale_id
    ORDER BY si.id
"""


async def _load_items(sale_id: str, session: AsyncSession) -> list[SaleItemRead]:
    result = await session.execute(text(_ITEMS_SELECT), {"sale_id": sale_id})
    return [SaleItemRead(**row) for row in result.mappings()]


async def _fetch_sale(sale_id: str, session: AsyncSession) -> SaleRead:
    result = await session.execute(text(f"{_SALE_SELECT} AND s.id = :id"), {"id": sale_id})
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")
    items = await _load_items(sale_id, session)
    return SaleRead(**row, items=items)


async def list_sales(
    clinic_id: str,
    session: AsyncSession,
    patient_id: str | None = None,
    owner_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[SaleRead]:
    await set_rls_context(session, clinic_id)
    filters = ""
    params: dict = {"limit": limit, "offset": offset}
    if patient_id:
        filters += " AND s.patient_id = :patient_id"
        params["patient_id"] = patient_id
    if owner_id:
        filters += " AND s.owner_id = :owner_id"
        params["owner_id"] = owner_id

    result = await session.execute(
        text(f"{_SALE_SELECT}{filters} ORDER BY s.created_at DESC LIMIT :limit OFFSET :offset"),
        params,
    )
    rows = list(result.mappings())
    sales = []
    for row in rows:
        items = await _load_items(str(row["id"]), session)
        sales.append(SaleRead(**row, items=items))
    return sales


async def get_sale(sale_id: str, clinic_id: str, session: AsyncSession) -> SaleRead:
    await set_rls_context(session, clinic_id)
    return await _fetch_sale(sale_id, session)


async def create_sale(
    clinic_id: str, clerk_user_id: str, data: SaleCreate, session: AsyncSession
) -> SaleRead:
    await set_rls_context(session, clinic_id)

    if not data.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La venta debe tener al menos un ítem")

    user_row = await session.execute(
        text("SELECT id FROM users WHERE clerk_user_id = :clerk_id AND deleted_at IS NULL LIMIT 1"),
        {"clerk_id": clerk_user_id},
    )
    db_user_id = user_row.scalar()

    for item in data.items:
        stock_row = await session.execute(
            text("SELECT stock FROM products WHERE id = :id AND deleted_at IS NULL"),
            {"id": item.product_id},
        )
        product = stock_row.mappings().first()
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Producto {item.product_id} no encontrado")
        if Decimal(str(product["stock"])) < item.quantity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Stock insuficiente para producto {item.product_id}")

    total = sum(item.unit_price * item.quantity for item in data.items)

    result = await session.execute(
        text("""
            INSERT INTO sales (clinic_id, user_id, patient_id, owner_id, total, notes)
            VALUES (:clinic_id, :user_id, :patient_id, :owner_id, :total, :notes)
            RETURNING id
        """),
        {
            "clinic_id": clinic_id,
            "user_id": str(db_user_id) if db_user_id else None,
            "patient_id": data.patient_id,
            "owner_id": data.owner_id,
            "total": total,
            "notes": data.notes,
        },
    )
    sale_id = str(result.scalar_one())

    for item in data.items:
        subtotal = item.unit_price * item.quantity
        await session.execute(
            text("""
                INSERT INTO sale_items (clinic_id, sale_id, product_id, quantity, unit_price, subtotal)
                VALUES (:clinic_id, :sale_id, :product_id, :quantity, :unit_price, :subtotal)
            """),
            {
                "clinic_id": clinic_id,
                "sale_id": sale_id,
                "product_id": item.product_id,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "subtotal": subtotal,
            },
        )
        await session.execute(
            text("UPDATE products SET stock = stock - :qty WHERE id = :id"),
            {"qty": item.quantity, "id": item.product_id},
        )
        await session.execute(
            text("""
                INSERT INTO stock_movements (clinic_id, product_id, user_id, movement_type, quantity, reason)
                VALUES (:clinic_id, :product_id, :user_id, 'exit', :quantity, :reason)
            """),
            {
                "clinic_id": clinic_id,
                "product_id": item.product_id,
                "user_id": str(db_user_id) if db_user_id else None,
                "quantity": item.quantity,
                "reason": f"Venta #{sale_id[:8]}",
            },
        )

    await session.commit()
    return await _fetch_sale(sale_id, session)


async def delete_sale(sale_id: str, clinic_id: str, session: AsyncSession) -> None:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text("UPDATE sales SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        {"id": sale_id},
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")
    await session.commit()
