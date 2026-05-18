from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_rls_context
from app.modules.sales.schemas import (
    SaleCreate,
    SaleItemCreate,
    SaleItemRead,
    SaleRead,
    SalesList,
    SaleUpdate,
)

_SALE_SELECT = """
    SELECT s.id, s.clinic_id, s.user_id, s.appointment_id,
           s.patient_id, p.name AS patient_name,
           s.owner_id, o.full_name AS owner_name,
           s.status, s.total, s.notes, s.created_at
    FROM sales s
    LEFT JOIN patients p ON p.id = s.patient_id AND p.deleted_at IS NULL
    LEFT JOIN owners o ON o.id = s.owner_id AND o.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
"""

_ITEMS_SELECT = """
    SELECT si.id, si.clinic_id, si.sale_id, si.product_id, si.service_id,
           COALESCE(pr.name, svc.name) AS item_name,
           si.quantity, si.unit_price, si.subtotal,
           si.professional_user_id,
           u.full_name AS professional_name
    FROM sale_items si
    LEFT JOIN products pr ON pr.id = si.product_id
    LEFT JOIN appointment_services svc ON svc.id = si.service_id
    LEFT JOIN users u ON u.id = si.professional_user_id
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


async def _resolve_db_user_id(clerk_user_id: str, session: AsyncSession) -> str | None:
    result = await session.execute(
        text("SELECT id FROM users WHERE clerk_user_id = :clerk_id AND deleted_at IS NULL LIMIT 1"),
        {"clerk_id": clerk_user_id},
    )
    val = result.scalar()
    return str(val) if val else None


async def _check_products_exist(items: list[SaleItemCreate], session: AsyncSession) -> None:
    """Solo valida que existan los productos. NO valida stock — el stock se valida al cobrar."""
    for item in items:
        if item.product_id:
            check = await session.execute(
                text("SELECT 1 FROM products WHERE id = :id AND deleted_at IS NULL"),
                {"id": item.product_id},
            )
            if check.scalar() is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Producto {item.product_id} no encontrado",
                )


async def _insert_items(
    clinic_id: str, sale_id: str, items: list[SaleItemCreate], session: AsyncSession
) -> Decimal:
    total = Decimal("0")
    for item in items:
        subtotal = item.unit_price * item.quantity
        total += subtotal
        await session.execute(
            text("""
                INSERT INTO sale_items
                    (clinic_id, sale_id, product_id, service_id, quantity,
                     unit_price, subtotal, professional_user_id)
                VALUES
                    (:clinic_id, :sale_id, :product_id, :service_id, :quantity,
                     :unit_price, :subtotal, :professional_user_id)
            """),
            {
                "clinic_id": clinic_id,
                "sale_id": sale_id,
                "product_id": item.product_id,
                "service_id": item.service_id,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "subtotal": subtotal,
                "professional_user_id": item.professional_user_id,
            },
        )
    return total


async def list_sales(
    clinic_id: str,
    session: AsyncSession,
    patient_id: str | None = None,
    owner_id: str | None = None,
    sale_status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> SalesList:
    await set_rls_context(session, clinic_id)
    filters = ""
    params: dict = {"limit": limit, "offset": offset}
    count_params: dict = {}
    if patient_id:
        filters += " AND s.patient_id = :patient_id"
        params["patient_id"] = patient_id
        count_params["patient_id"] = patient_id
    if owner_id:
        filters += " AND s.owner_id = :owner_id"
        params["owner_id"] = owner_id
        count_params["owner_id"] = owner_id
    if sale_status:
        filters += " AND s.status = :sale_status"
        params["sale_status"] = sale_status
        count_params["sale_status"] = sale_status

    items_result = await session.execute(
        text(f"{_SALE_SELECT}{filters} ORDER BY s.created_at DESC LIMIT :limit OFFSET :offset"),
        params,
    )
    rows = list(items_result.mappings())
    sales = []
    for row in rows:
        items = await _load_items(str(row["id"]), session)
        sales.append(SaleRead(**row, items=items))

    count_sql = "SELECT COUNT(*) FROM sales s WHERE s.deleted_at IS NULL" + filters
    total = (await session.execute(text(count_sql), count_params)).scalar() or 0
    return SalesList(items=sales, total=total)


async def get_sale(sale_id: str, clinic_id: str, session: AsyncSession) -> SaleRead:
    await set_rls_context(session, clinic_id)
    return await _fetch_sale(sale_id, session)


async def create_sale(
    clinic_id: str, clerk_user_id: str, data: SaleCreate, session: AsyncSession
) -> SaleRead:
    """Crea una venta en estado 'pending'. NO descuenta stock todavía."""
    await set_rls_context(session, clinic_id)

    if not data.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La venta debe tener al menos un ítem")

    await _check_products_exist(data.items, session)
    db_user_id = await _resolve_db_user_id(clerk_user_id, session)

    # Insert sale en pending; total se completa después
    result = await session.execute(
        text("""
            INSERT INTO sales (clinic_id, user_id, appointment_id, patient_id, owner_id, total, notes, status)
            VALUES (:clinic_id, :user_id, :appointment_id, :patient_id, :owner_id, 0, :notes, 'pending')
            RETURNING id
        """),
        {
            "clinic_id": clinic_id,
            "user_id": db_user_id,
            "appointment_id": data.appointment_id,
            "patient_id": data.patient_id,
            "owner_id": data.owner_id,
            "notes": data.notes,
        },
    )
    sale_id = str(result.scalar_one())

    total = await _insert_items(clinic_id, sale_id, data.items, session)
    await session.execute(
        text("UPDATE sales SET total = :total WHERE id = :id"),
        {"total": total, "id": sale_id},
    )

    await session.commit()
    return await _fetch_sale(sale_id, session)


async def update_sale(
    sale_id: str, clinic_id: str, data: SaleUpdate, session: AsyncSession
) -> SaleRead:
    """Edita una venta. Solo permite cambios mientras esté en 'pending'."""
    await set_rls_context(session, clinic_id)

    cur = await session.execute(
        text("SELECT status FROM sales WHERE id = :id AND deleted_at IS NULL"),
        {"id": sale_id},
    )
    row = cur.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")
    if row["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden editar ventas pendientes",
        )

    if data.notes is not None:
        await session.execute(
            text("UPDATE sales SET notes = :notes WHERE id = :id"),
            {"notes": data.notes, "id": sale_id},
        )

    if data.items is not None:
        if not data.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La venta debe tener al menos un ítem",
            )
        await _check_products_exist(data.items, session)
        # Reemplazar todos los items
        await session.execute(
            text("DELETE FROM sale_items WHERE sale_id = :id"),
            {"id": sale_id},
        )
        total = await _insert_items(clinic_id, sale_id, data.items, session)
        await session.execute(
            text("UPDATE sales SET total = :total WHERE id = :id"),
            {"total": total, "id": sale_id},
        )

    await session.commit()
    return await _fetch_sale(sale_id, session)


async def finalize_sale(
    sale_id: str, clinic_id: str, clerk_user_id: str, session: AsyncSession
) -> SaleRead:
    """Cobra una venta pendiente: cambia status a 'completed' y descuenta stock."""
    await set_rls_context(session, clinic_id)

    cur = await session.execute(
        text("SELECT status FROM sales WHERE id = :id AND deleted_at IS NULL"),
        {"id": sale_id},
    )
    row = cur.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")
    if row["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La venta no está pendiente (estado actual: {row['status']})",
        )

    # Validar stock para todos los productos antes de descontar
    items_res = await session.execute(
        text("""
            SELECT product_id, quantity
            FROM sale_items
            WHERE sale_id = :sid AND product_id IS NOT NULL
        """),
        {"sid": sale_id},
    )
    product_items = list(items_res.mappings())
    for it in product_items:
        stock_res = await session.execute(
            text("SELECT name, stock FROM products WHERE id = :id AND deleted_at IS NULL"),
            {"id": str(it["product_id"])},
        )
        prod = stock_res.mappings().first()
        if prod is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Producto {it['product_id']} no encontrado",
            )
        if Decimal(str(prod["stock"])) < it["quantity"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock insuficiente para {prod['name']}",
            )

    # Descontar stock + crear movements
    db_user_id = await _resolve_db_user_id(clerk_user_id, session)
    for it in product_items:
        await session.execute(
            text("UPDATE products SET stock = stock - :qty WHERE id = :id"),
            {"qty": it["quantity"], "id": str(it["product_id"])},
        )
        await session.execute(
            text("""
                INSERT INTO stock_movements
                    (clinic_id, product_id, user_id, movement_type, quantity, reason)
                VALUES
                    (:clinic_id, :product_id, :user_id, 'exit', :quantity, :reason)
            """),
            {
                "clinic_id": clinic_id,
                "product_id": str(it["product_id"]),
                "user_id": db_user_id,
                "quantity": it["quantity"],
                "reason": f"Venta #{sale_id[:8]}",
            },
        )

    await session.execute(
        text("UPDATE sales SET status = 'completed' WHERE id = :id"),
        {"id": sale_id},
    )
    await session.commit()
    return await _fetch_sale(sale_id, session)


async def cancel_sale(sale_id: str, clinic_id: str, session: AsyncSession) -> None:
    """Cancela una venta. Si estaba pendiente, no toca stock.
    Si estaba completed, devuelve stock al inventario."""
    await set_rls_context(session, clinic_id)

    cur = await session.execute(
        text("SELECT status FROM sales WHERE id = :id AND deleted_at IS NULL"),
        {"id": sale_id},
    )
    row = cur.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")

    if row["status"] == "completed":
        # Devolver stock
        items_res = await session.execute(
            text("""
                SELECT product_id, quantity
                FROM sale_items
                WHERE sale_id = :sid AND product_id IS NOT NULL
            """),
            {"sid": sale_id},
        )
        for it in items_res.mappings():
            await session.execute(
                text("UPDATE products SET stock = stock + :qty WHERE id = :id"),
                {"qty": it["quantity"], "id": str(it["product_id"])},
            )

    await session.execute(
        text("UPDATE sales SET status = 'cancelled' WHERE id = :id"),
        {"id": sale_id},
    )
    await session.commit()


async def delete_sale(sale_id: str, clinic_id: str, session: AsyncSession) -> None:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text("UPDATE sales SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        {"id": sale_id},
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")
    await session.commit()
