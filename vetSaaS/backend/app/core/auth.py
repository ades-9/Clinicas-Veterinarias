import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

bearer = HTTPBearer()

# Cache en memoria del JWKS de Clerk (se renueva si falla la verificación)
_jwks_cache: dict | None = None


async def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(settings.clerk_jwks_url, timeout=10)
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache


async def decode_clerk_token(token: str) -> dict:
    """Verifica y decodifica un JWT de Clerk usando JWKS (RS256)."""
    global _jwks_cache
    try:
        jwks = await _get_jwks()
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return payload
    except JWTError:
        # Si falla, puede ser que el JWKS esté desactualizado — limpiamos caché y reintentamos
        _jwks_cache = None
        try:
            jwks = await _get_jwks()
            payload = jwt.decode(
                token,
                jwks,
                algorithms=["RS256"],
                options={"verify_aud": False},
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
    payload = await decode_clerk_token(credentials.credentials)

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
