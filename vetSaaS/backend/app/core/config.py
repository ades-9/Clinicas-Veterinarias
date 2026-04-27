from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    clerk_secret_key: str
    clerk_publishable_key: str
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


settings = Settings()
