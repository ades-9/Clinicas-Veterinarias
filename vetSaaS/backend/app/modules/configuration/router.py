import asyncio

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.core.permissions import require_permission
from app.core.storage import clinic_logo_key, upload_file
from app.modules.configuration import crud
from app.modules.configuration.schemas import ClinicRead, ClinicUpdate

router = APIRouter(prefix="/configuration", tags=["configuration"])

_ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}


@router.get("", response_model=ClinicRead)
async def get_configuration(
    user: CurrentUser = require_permission("configuration.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.get_clinic(user.clinic_id, session)


@router.patch("", response_model=ClinicRead)
async def update_configuration(
    data: ClinicUpdate,
    user: CurrentUser = require_permission("configuration.edit"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.update_clinic(user.clinic_id, data, session)


@router.post("/logo", response_model=ClinicRead)
async def upload_logo(
    file: UploadFile = File(...),
    user: CurrentUser = require_permission("configuration.edit"),
    session: AsyncSession = Depends(get_db),
):
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Solo se permiten imágenes PNG, JPEG o WebP",
        )
    content = await file.read()
    key = clinic_logo_key(user.clinic_id)
    logo_url = await asyncio.to_thread(upload_file, content, key, file.content_type)
    return await crud.update_logo_url(user.clinic_id, logo_url, session)
