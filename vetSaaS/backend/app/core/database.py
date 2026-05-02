from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=not settings.is_production)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def set_rls_context(session: AsyncSession, clinic_id: str) -> None:
    """Set PostgreSQL RLS context variable for the current session."""
    await session.execute(
        text("SELECT set_config('app.current_clinic_id', :clinic_id, TRUE)"),
        {"clinic_id": clinic_id},
    )
