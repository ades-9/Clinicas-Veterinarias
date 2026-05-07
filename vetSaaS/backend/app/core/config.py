import base64

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    clerk_secret_key: str
    clerk_publishable_key: str
    clerk_jwks_url: str = ""
    r2_account_id: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_bucket_name: str = "vetsaas-storage"
    r2_endpoint_url: str = ""
    resend_api_key: str
    environment: str = "development"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def resolved_jwks_url(self) -> str:
        if self.clerk_jwks_url:
            return self.clerk_jwks_url
        # Deriva la URL del JWKS a partir del publishable key de Clerk
        # Formato: pk_test_<base64(domain$)> o pk_live_<base64(domain$)>
        try:
            raw = self.clerk_publishable_key.split("_", 2)[-1]
            padding = 4 - len(raw) % 4
            domain = base64.b64decode(raw + "=" * padding).decode().rstrip("$")
            return f"https://{domain}/.well-known/jwks.json"
        except Exception:
            raise ValueError("No se pudo derivar CLERK_JWKS_URL del publishable key")


settings = Settings()
