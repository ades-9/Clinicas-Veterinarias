from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db
from app.modules.catalog.schemas import BreedRead, ProductUnitRead, SpeciesRead

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/species", response_model=list[SpeciesRead])
async def list_species(
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(text("SELECT id, name FROM species ORDER BY name"))
    return [SpeciesRead(**row) for row in result.mappings()]


@router.get("/breeds", response_model=list[BreedRead])
async def list_breeds(
    species_id: str | None = Query(default=None),
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    if species_id:
        result = await session.execute(
            text("SELECT id, species_id, name FROM breeds WHERE species_id = :sid ORDER BY name"),
            {"sid": species_id},
        )
    else:
        result = await session.execute(
            text("SELECT id, species_id, name FROM breeds ORDER BY name")
        )
    return [BreedRead(**row) for row in result.mappings()]


@router.get("/product-units", response_model=list[ProductUnitRead])
async def list_product_units(
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(text("SELECT id, name FROM product_units ORDER BY name"))
    return [ProductUnitRead(**row) for row in result.mappings()]
