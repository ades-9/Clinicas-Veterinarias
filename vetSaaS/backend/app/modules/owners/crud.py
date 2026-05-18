from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_rls_context
from app.modules.owners.schemas import OwnerCreate, OwnerRead, OwnersList, OwnerUpdate

_OWNER_SELECT = """
    SELECT id, clinic_id, full_name, id_number, phone, email, address,
           preferred_contact, created_at
    FROM owners
    WHERE deleted_at IS NULL
"""


async def list_owners(
    clinic_id: str,
    session: AsyncSession,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> OwnersList:
    await set_rls_context(session, clinic_id)

    if q:
        params = {"q": f"%{q}%", "limit": limit, "offset": offset}
        items_sql = f"""
            {_OWNER_SELECT}
              AND (full_name ILIKE :q OR email ILIKE :q OR phone ILIKE :q OR id_number ILIKE :q)
            ORDER BY full_name
            LIMIT :limit OFFSET :offset
        """
        count_sql = """
            SELECT COUNT(*) FROM owners
            WHERE deleted_at IS NULL
              AND (full_name ILIKE :q OR email ILIKE :q OR phone ILIKE :q OR id_number ILIKE :q)
        """
    else:
        params = {"limit": limit, "offset": offset}
        items_sql = f"{_OWNER_SELECT} ORDER BY full_name LIMIT :limit OFFSET :offset"
        count_sql = "SELECT COUNT(*) FROM owners WHERE deleted_at IS NULL"

    items_result = await session.execute(text(items_sql), params)
    items = [OwnerRead(**row) for row in items_result.mappings()]

    count_params = {"q": params["q"]} if q else {}
    total = (await session.execute(text(count_sql), count_params)).scalar() or 0
    return OwnersList(items=items, total=total)


async def list_all_owners_for_export(
    clinic_id: str, session: AsyncSession, q: str | None = None
) -> list[OwnerRead]:
    """Para exportación: trae todos los propietarios sin paginar."""
    await set_rls_context(session, clinic_id)
    if q:
        result = await session.execute(
            text(f"""
                {_OWNER_SELECT}
                  AND (full_name ILIKE :q OR email ILIKE :q OR phone ILIKE :q OR id_number ILIKE :q)
                ORDER BY full_name
            """),
            {"q": f"%{q}%"},
        )
    else:
        result = await session.execute(text(f"{_OWNER_SELECT} ORDER BY full_name"))
    return [OwnerRead(**row) for row in result.mappings()]


async def get_owner(owner_id: str, clinic_id: str, session: AsyncSession) -> OwnerRead:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text(f"{_OWNER_SELECT} AND id = :id"),
        {"id": owner_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propietario no encontrado")
    return OwnerRead(**row)


async def create_owner(clinic_id: str, data: OwnerCreate, session: AsyncSession) -> OwnerRead:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text("""
            INSERT INTO owners (clinic_id, full_name, id_number, phone, email, address, preferred_contact)
            VALUES (:clinic_id, :full_name, :id_number, :phone, :email, :address, :preferred_contact)
            RETURNING id, clinic_id, full_name, id_number, phone, email, address,
                      preferred_contact, created_at
        """),
        {"clinic_id": clinic_id, **data.model_dump()},
    )
    owner = OwnerRead(**result.mappings().first())
    await session.commit()
    return owner


async def update_owner(owner_id: str, clinic_id: str, data: OwnerUpdate, session: AsyncSession) -> OwnerRead:
    await set_rls_context(session, clinic_id)

    fields = data.model_dump(exclude_unset=True)
    if not fields:
        return await get_owner(owner_id, clinic_id, session)

    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["id"] = owner_id

    result = await session.execute(
        text(f"UPDATE owners SET {set_clause} WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        fields,
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propietario no encontrado")

    await session.commit()
    return await get_owner(owner_id, clinic_id, session)


async def delete_owner(owner_id: str, clinic_id: str, session: AsyncSession) -> None:
    await set_rls_context(session, clinic_id)

    # Bloquear si el propietario tiene mascotas activas
    pets_count = await session.execute(
        text("SELECT COUNT(*) FROM patients WHERE owner_id = :id AND deleted_at IS NULL"),
        {"id": owner_id},
    )
    n = pets_count.scalar() or 0
    if n > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar: el propietario tiene {n} mascota(s) registrada(s)",
        )

    result = await session.execute(
        text("UPDATE owners SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        {"id": owner_id},
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propietario no encontrado")
    await session.commit()
