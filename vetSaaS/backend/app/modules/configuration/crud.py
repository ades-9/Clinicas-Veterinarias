from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.configuration.schemas import ClinicRead, ClinicUpdate


async def get_clinic(clinic_id: str, session: AsyncSession) -> ClinicRead:
    result = await session.execute(
        text("""
            SELECT id, name, phone, address, email, tax_id, logo_url, is_active, created_at
            FROM clinics
            WHERE id = :id AND deleted_at IS NULL
        """),
        {"id": clinic_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clínica no encontrada")
    return ClinicRead(**row)


async def update_clinic(clinic_id: str, data: ClinicUpdate, session: AsyncSession) -> ClinicRead:
    fields = data.model_dump(exclude_unset=True)
    if not fields:
        return await get_clinic(clinic_id, session)

    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["id"] = clinic_id

    await session.execute(
        text(f"UPDATE clinics SET {set_clause} WHERE id = :id AND deleted_at IS NULL"),
        fields,
    )
    await session.commit()
    return await get_clinic(clinic_id, session)


async def update_logo_url(clinic_id: str, logo_url: str, session: AsyncSession) -> ClinicRead:
    await session.execute(
        text("UPDATE clinics SET logo_url = :url WHERE id = :id AND deleted_at IS NULL"),
        {"url": logo_url, "id": clinic_id},
    )
    await session.commit()
    return await get_clinic(clinic_id, session)
