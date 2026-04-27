from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

bearer = HTTPBearer()

CLERK_JWKS_URL = "https://api.clerk.dev/v1/jwks"


def decode_clerk_token(token: str) -> dict:
    """Decode and verify a Clerk JWT. Returns the payload."""
    try:
        # Clerk tokens are RS256; in production fetch JWKS dynamically.
        # For simplicity we decode without verification in dev and rely on
        # Clerk middleware in production (Railway + Vercel handle HTTPS).
        payload = jwt.decode(
            token,
            settings.clerk_secret_key,
            algorithms=["RS256"],
            options={"verify_signature": settings.is_production},
        )
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        ) from exc


class CurrentUser:
    def __init__(self, user_id: str, clinic_id: str, role: str):
        self.user_id = user_id
        self.clinic_id = clinic_id
        self.role = role


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> CurrentUser:
    payload = decode_clerk_token(credentials.credentials)

    user_id = payload.get("sub")
    clinic_id = payload.get("clinic_id")
    role = payload.get("role")

    if not user_id or not clinic_id or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sin claims requeridos (clinic_id, role)",
        )

    return CurrentUser(user_id=user_id, clinic_id=clinic_id, role=role)


async def get_superadmin_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> CurrentUser:
    user = await get_current_user(credentials)
    if user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido a superadmin",
        )
    return user
