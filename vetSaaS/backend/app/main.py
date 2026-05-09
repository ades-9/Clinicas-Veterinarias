from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="VetSaaS API",
    version="0.1.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://vetsaas.vercel.app"] if settings.is_production else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["infra"])
async def health():
    return {"status": "ok"}


from app.modules.appointments.router import router as appointments_router
from app.modules.appointments.router import services_router as appointment_services_router
from app.modules.catalog.router import router as catalog_router
from app.modules.configuration.register import router as register_router
from app.modules.configuration.router import router as configuration_router
from app.modules.medical_records.router import (
    patient_history_router,
    router as medical_records_router,
)
from app.modules.owners.router import router as owners_router
from app.modules.patients.router import router as patients_router
from app.modules.products.router import categories_router, movements_router, router as products_router
from app.modules.sales.router import router as sales_router
from app.modules.users.router import roles_router, router as users_router

app.include_router(catalog_router, prefix="/api/v1")
app.include_router(register_router, prefix="/api/v1")
app.include_router(configuration_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(roles_router, prefix="/api/v1")
app.include_router(owners_router, prefix="/api/v1")
app.include_router(patients_router, prefix="/api/v1")
app.include_router(appointment_services_router, prefix="/api/v1")
app.include_router(appointments_router, prefix="/api/v1")
app.include_router(medical_records_router, prefix="/api/v1")
app.include_router(patient_history_router, prefix="/api/v1")
app.include_router(categories_router, prefix="/api/v1")
app.include_router(products_router, prefix="/api/v1")
app.include_router(movements_router, prefix="/api/v1")
app.include_router(sales_router, prefix="/api/v1")
