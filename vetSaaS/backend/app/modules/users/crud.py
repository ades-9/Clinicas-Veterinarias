import secrets

import httpx
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import set_rls_context
from app.modules.users.schemas import (
    MeRead,
    PermissionCatalogItem,
    RolePermissionsRead,
    RolePermissionsUpdate,
    RoleRead,
    UserCreate,
    UserCreateResponse,
    UserRead,
    UserUpdate,
)

_USER_SELECT = """
    SELECT u.id, u.clinic_id, u.role_id, r.name AS role_name,
           u.clerk_user_id, u.full_name, u.email, u.is_active,
           COALESCE(u.areas, '{}'::text[]) AS areas, u.created_at
    FROM users u
    JOIN roles r ON r.id = u.role_id
"""


async def _get_role(role_id: str, clinic_id: str, session: AsyncSession) -> RoleRead:
    result = await session.execute(
        text("SELECT id, name FROM roles WHERE id = :id AND clinic_id = :clinic_id"),
        {"id": role_id, "clinic_id": clinic_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado")
    return RoleRead(**row)


async def list_users(clinic_id: str, session: AsyncSession) -> list[UserRead]:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text(f"{_USER_SELECT} WHERE u.deleted_at IS NULL ORDER BY u.created_at"),
    )
    return [UserRead(**row) for row in result.mappings()]


async def get_user(user_id: str, clinic_id: str, session: AsyncSession) -> UserRead:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text(f"{_USER_SELECT} WHERE u.id = :id AND u.deleted_at IS NULL"),
        {"id": user_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return UserRead(**row)


async def list_roles(clinic_id: str, session: AsyncSession) -> list[RoleRead]:
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text("SELECT id, name FROM roles WHERE clinic_id = :clinic_id ORDER BY name"),
        {"clinic_id": clinic_id},
    )
    return [RoleRead(**row) for row in result.mappings()]


async def create_user(clinic_id: str, data: UserCreate, session: AsyncSession) -> UserCreateResponse:
    await set_rls_context(session, clinic_id)

    role = await _get_role(data.role_id, clinic_id, session)

    existing = await session.execute(
        text("SELECT 1 FROM users WHERE email = :email AND deleted_at IS NULL"),
        {"email": data.email},
    )
    if existing.scalar():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un usuario con ese email")

    name_parts = data.full_name.strip().split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    temp_password = secrets.token_urlsafe(16) + "A1!"

    # Crear usuario en Clerk primero
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.clerk.com/v1/users",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            json={
                "email_address": [data.email],
                "first_name": first_name,
                "last_name": last_name,
                "password": temp_password,
                "public_metadata": {"clinic_id": clinic_id, "role": role.name},
            },
            timeout=10,
        )
        if resp.status_code not in (200, 201):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No se pudo crear el usuario en Clerk. Verifica que el email no esté registrado.",
            )
        clerk_user_id = resp.json()["id"]

    try:
        result = await session.execute(
            text("""
                WITH inserted AS (
                    INSERT INTO users (clinic_id, role_id, clerk_user_id, full_name, email, areas)
                    VALUES (:clinic_id, :role_id, :clerk_user_id, :full_name, :email, :areas)
                    RETURNING *
                )
                SELECT i.id, i.clinic_id, i.role_id, r.name AS role_name,
                       i.clerk_user_id, i.full_name, i.email, i.is_active,
                       COALESCE(i.areas, '{}'::text[]) AS areas, i.created_at
                FROM inserted i
                JOIN roles r ON r.id = i.role_id
            """),
            {
                "clinic_id": clinic_id,
                "role_id": data.role_id,
                "clerk_user_id": clerk_user_id,
                "full_name": data.full_name,
                "email": data.email,
                "areas": data.areas,
            },
        )
        user = UserRead(**result.mappings().first())
        await session.commit()
        return UserCreateResponse(user=user, temporary_password=temp_password)
    except Exception:
        # Revertir usuario en Clerk si el commit falla
        async with httpx.AsyncClient() as client:
            await client.delete(
                f"https://api.clerk.com/v1/users/{clerk_user_id}",
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
                timeout=10,
            )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al guardar el usuario")


async def update_user(user_id: str, clinic_id: str, data: UserUpdate, session: AsyncSession) -> UserRead:
    await set_rls_context(session, clinic_id)

    fields = data.model_dump(exclude_unset=True)
    if not fields:
        return await get_user(user_id, clinic_id, session)

    new_role_name: str | None = None
    if "role_id" in fields:
        role = await _get_role(fields["role_id"], clinic_id, session)
        new_role_name = role.name

    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["id"] = user_id

    result = await session.execute(
        text(f"""
            UPDATE users SET {set_clause}
            WHERE id = :id AND deleted_at IS NULL
            RETURNING clerk_user_id
        """),
        fields,
    )
    clerk_user_id = result.scalar()
    if clerk_user_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    if new_role_name:
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"https://api.clerk.com/v1/users/{clerk_user_id}",
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
                json={"public_metadata": {"clinic_id": clinic_id, "role": new_role_name}},
                timeout=10,
            )
            if resp.status_code not in (200, 201):
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="No se pudo actualizar el rol en Clerk",
                )

    await session.commit()
    return await get_user(user_id, clinic_id, session)


async def get_me(clinic_id: str, clerk_user_id: str, role_name: str, session: AsyncSession) -> MeRead:
    """Devuelve el usuario autenticado + sus permisos efectivos.

    Si el rol es 'superadmin' (plataforma), devuelve todos los permisos del catálogo.
    """
    await set_rls_context(session, clinic_id)
    result = await session.execute(
        text(f"{_USER_SELECT} WHERE u.clerk_user_id = :clerk_user_id AND u.deleted_at IS NULL"),
        {"clerk_user_id": clerk_user_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    user = UserRead(**row)

    if role_name == "superadmin":
        perms_result = await session.execute(text("SELECT action FROM permissions"))
    else:
        perms_result = await session.execute(
            text("""
                SELECT p.action
                FROM permissions p
                JOIN role_permissions rp ON rp.permission_id = p.id
                WHERE rp.role_id = :role_id
            """),
            {"role_id": str(user.role_id)},
        )
    permissions = [r[0] for r in perms_result.all()]
    return MeRead(user=user, permissions=permissions)


async def list_permissions_catalog(session: AsyncSession) -> list[PermissionCatalogItem]:
    result = await session.execute(text("SELECT action FROM permissions ORDER BY action"))
    return [PermissionCatalogItem(action=r[0]) for r in result.all()]


async def get_role_permissions(role_id: str, clinic_id: str, session: AsyncSession) -> RolePermissionsRead:
    await set_rls_context(session, clinic_id)
    role = await _get_role(role_id, clinic_id, session)
    result = await session.execute(
        text("""
            SELECT p.action
            FROM permissions p
            JOIN role_permissions rp ON rp.permission_id = p.id
            WHERE rp.role_id = :role_id
            ORDER BY p.action
        """),
        {"role_id": role_id},
    )
    perms = [r[0] for r in result.all()]
    return RolePermissionsRead(role_id=role.id, role_name=role.name, permissions=perms)


async def update_role_permissions(
    role_id: str, clinic_id: str, data: RolePermissionsUpdate, session: AsyncSession
) -> RolePermissionsRead:
    await set_rls_context(session, clinic_id)
    role = await _get_role(role_id, clinic_id, session)

    if role.name == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El rol administrador no puede modificar sus propios permisos",
        )

    # Validar que todos los permisos existan
    if data.permissions:
        check = await session.execute(
            text("SELECT action FROM permissions WHERE action = ANY(:actions)"),
            {"actions": data.permissions},
        )
        valid = {r[0] for r in check.all()}
        invalid = set(data.permissions) - valid
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Permisos inválidos: {sorted(invalid)}",
            )

    await session.execute(
        text("DELETE FROM role_permissions WHERE role_id = :role_id"),
        {"role_id": role_id},
    )
    if data.permissions:
        await session.execute(
            text("""
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT :role_id, id FROM permissions WHERE action = ANY(:actions)
            """),
            {"role_id": role_id, "actions": data.permissions},
        )
    await session.commit()
    return await get_role_permissions(role_id, clinic_id, session)


async def deactivate_user(user_id: str, clinic_id: str, current_clerk_user_id: str, session: AsyncSession) -> None:
    await set_rls_context(session, clinic_id)

    result = await session.execute(
        text("""
            UPDATE users
            SET is_active = FALSE, deleted_at = NOW()
            WHERE id = :id AND deleted_at IS NULL AND clerk_user_id != :self_id
            RETURNING id
        """),
        {"id": user_id, "self_id": current_clerk_user_id},
    )
    if result.scalar() is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no encontrado o no puedes desactivar tu propia cuenta",
        )
    await session.commit()
