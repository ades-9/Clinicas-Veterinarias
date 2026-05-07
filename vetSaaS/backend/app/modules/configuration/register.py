import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_clerk_user_id
from app.core.config import settings
from app.core.database import get_db, set_rls_context

router = APIRouter(tags=["onboarding"])

_ALL_MODULES = [
    "medical_records", "appointments", "reminders",
    "products", "sales", "reports",
]


class RegisterRequest(BaseModel):
    clinic_name: str
    full_name: str
    email: str


class RegisterResponse(BaseModel):
    clinic_id: str
    user_id: str


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register_clinic(
    data: RegisterRequest,
    clerk_user_id: str = Depends(get_clerk_user_id),
    session: AsyncSession = Depends(get_db),
):
    existing = await session.execute(
        text("SELECT clinic_id FROM users WHERE clerk_user_id = :id AND deleted_at IS NULL"),
        {"id": clerk_user_id},
    )
    if existing.scalar():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este usuario ya tiene una clínica registrada",
        )

    clinic_row = await session.execute(
        text("INSERT INTO clinics (name, email) VALUES (:name, :email) RETURNING id"),
        {"name": data.clinic_name, "email": data.email},
    )
    clinic_id = str(clinic_row.scalar_one())
    await set_rls_context(session, clinic_id)

    role_row = await session.execute(
        text("INSERT INTO roles (clinic_id, name) VALUES (:clinic_id, 'admin') RETURNING id"),
        {"clinic_id": clinic_id},
    )
    role_id = str(role_row.scalar_one())

    await session.execute(
        text("INSERT INTO role_permissions (role_id, permission_id) SELECT :role_id, id FROM permissions"),
        {"role_id": role_id},
    )

    user_row = await session.execute(
        text("""
            INSERT INTO users (clinic_id, role_id, clerk_user_id, full_name, email)
            VALUES (:clinic_id, :role_id, :clerk_user_id, :full_name, :email)
            RETURNING id
        """),
        {
            "clinic_id": clinic_id,
            "role_id": role_id,
            "clerk_user_id": clerk_user_id,
            "full_name": data.full_name,
            "email": data.email,
        },
    )
    user_id = str(user_row.scalar_one())

    for module in _ALL_MODULES:
        await session.execute(
            text("""
                INSERT INTO clinic_modules (clinic_id, module, is_active, activated_at)
                VALUES (:clinic_id, :module, TRUE, NOW())
            """),
            {"clinic_id": clinic_id, "module": module},
        )

    # Actualizar Clerk ANTES de hacer commit: si falla, el rollback es automático
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"https://api.clerk.com/v1/users/{clerk_user_id}",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            json={"public_metadata": {"clinic_id": clinic_id, "role": "admin"}},
            timeout=10,
        )
        if resp.status_code not in (200, 201):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No se pudo actualizar el token de Clerk. Intente nuevamente.",
            )

    await session.commit()
    return RegisterResponse(clinic_id=clinic_id, user_id=user_id)
