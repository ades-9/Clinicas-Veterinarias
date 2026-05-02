import asyncio
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.core.permissions import require_permission
from app.core.storage import medical_record_attachment_key, upload_file
from app.modules.medical_records import crud
from app.modules.medical_records.schemas import (
    AttachmentRead,
    MedicalRecordCreate,
    MedicalRecordRead,
    MedicalRecordUpdate,
    VaccinationCreate,
    VaccinationRead,
)

router = APIRouter(prefix="/medical-records", tags=["medical_records"])

_ALLOWED_ATTACHMENT_TYPES = {
    "image/png", "image/jpeg", "image/webp",
    "application/pdf",
}


@router.get("", response_model=list[MedicalRecordRead])
async def list_records(
    patient_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = require_permission("medical_records.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.list_records(user.clinic_id, session, patient_id=patient_id, limit=limit, offset=offset)


@router.get("/{record_id}", response_model=MedicalRecordRead)
async def get_record(
    record_id: str,
    user: CurrentUser = require_permission("medical_records.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.get_record(record_id, user.clinic_id, session)


@router.post("", response_model=MedicalRecordRead, status_code=http_status.HTTP_201_CREATED)
async def create_record(
    data: MedicalRecordCreate,
    user: CurrentUser = require_permission("medical_records.create"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.create_record(user.clinic_id, user.user_id, data, session)


@router.patch("/{record_id}", response_model=MedicalRecordRead)
async def update_record(
    record_id: str,
    data: MedicalRecordUpdate,
    user: CurrentUser = require_permission("medical_records.edit"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.update_record(record_id, user.clinic_id, data, session)


@router.post("/{record_id}/attachments", response_model=AttachmentRead, status_code=http_status.HTTP_201_CREATED)
async def upload_attachment(
    record_id: str,
    file: UploadFile = File(...),
    user: CurrentUser = require_permission("medical_records.edit"),
    session: AsyncSession = Depends(get_db),
):
    if file.content_type not in _ALLOWED_ATTACHMENT_TYPES:
        raise HTTPException(
            status_code=http_status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Solo se permiten imágenes (PNG, JPEG, WebP) o PDF",
        )
    content = await file.read()
    unique_name = f"{uuid.uuid4()}_{file.filename}"
    key = medical_record_attachment_key(user.clinic_id, record_id, unique_name)
    file_url = await asyncio.to_thread(upload_file, content, key, file.content_type)
    return await crud.add_attachment(record_id, user.clinic_id, file_url, file.filename, file.content_type, session)


@router.post("/{record_id}/vaccinations", response_model=VaccinationRead, status_code=http_status.HTTP_201_CREATED)
async def add_vaccination(
    record_id: str,
    data: VaccinationCreate,
    user: CurrentUser = require_permission("medical_records.edit"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.add_vaccination(record_id, user.clinic_id, data, session)
