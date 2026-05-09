from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_rls_context
from app.modules.owners.schemas import OwnerCreate, OwnerRead, OwnerUpdate

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
) -> list[OwnerRead]:
    await set_rls_context(session, clinic_id)

    if q:
        result = await session.execute(
            text(f"""
                {_OWNER_SELECT}
                  AND (full_name ILIKE :q OR email ILIKE :q OR phone ILIKE :q OR id_number ILIKE :q)
                ORDER BY full_name
                LIMIT :limit OFFSET :offset
            """),
            {"q": f"%{q}%", "limit": limit, "offset": offset},
        )
    else:
        result = await session.execute(
            text(f"{_OWNER_SELECT} ORDER BY full_name LIMIT :limit OFFSET :offset"),
            {"limit": limit, "offset": offset},
        )
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
    result = await session.execute(
        text("UPDATE owners SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL RETURNING id"),
        {"id": owner_id},
    )
    if result.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propietario no encontrado")
    await session.commit()
