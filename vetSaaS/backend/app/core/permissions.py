from collections.abc import Callable
from functools import wraps

from fastapi import Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db


async def check_permission(
    action: str,
    user: CurrentUser,
    session: AsyncSession,
) -> bool:
    """Return True if user's role has the given permission action."""
    result = await session.execute(
        text(
            """
            SELECT 1
            FROM role_permissions rp
            JOIN permissions p ON p.id = rp.permission_id
            JOIN roles r ON r.id = rp.role_id
            JOIN users u ON u.role_id = r.id
            WHERE u.clerk_user_id = :clerk_user_id
              AND p.action = :action
              AND u.is_active = TRUE
            LIMIT 1
            """
        ),
        {"clerk_user_id": user.user_id, "action": action},
    )
    return result.scalar() is not None


def require_permission(action: str) -> Callable:
    """Decorator/dependency factory that enforces a permission action."""

    async def dependency(
        user: CurrentUser = Depends(get_current_user),
        session: AsyncSession = Depends(get_db),
    ) -> CurrentUser:
        if user.role == "superadmin":
            return user
        has_perm = await check_permission(action, user, session)
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso requerido: {action}",
            )
        return user

    return Depends(dependency)


async def check_module_active(module: str, clinic_id: str, session: AsyncSession) -> None:
    """Raise 403 if the module is not active for the clinic."""
    result = await session.execute(
        text(
            """
            SELECT 1 FROM clinic_modules
            WHERE clinic_id = :clinic_id
              AND module = :module
              AND is_active = TRUE
            LIMIT 1
            """
        ),
        {"clinic_id": clinic_id, "module": module},
    )
    if result.scalar() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Módulo '{module}' no está activo para esta clínica",
        )
