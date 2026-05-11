import asyncio
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db, set_rls_context
from app.core.permissions import require_permission
from app.core.storage import patient_photo_key, upload_file
from app.modules.patients import crud
from app.modules.patients.schemas import PatientCreate, PatientRead, PatientUpdate

router = APIRouter(prefix="/patients", tags=["patients"])

_ALLOWED_PHOTO_TYPES = {"image/png", "image/jpeg", "image/webp"}


@router.get("", response_model=list[PatientRead])
async def list_patients(
    q: str | None = Query(default=None, description="Buscar por nombre del paciente, dueño o código de vacuna"),
    owner_id: str | None = Query(default=None, description="Filtrar por propietario"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = require_permission("patients.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.list_patients(user.clinic_id, session, q=q, owner_id=owner_id, limit=limit, offset=offset)


@router.get("/{patient_id}", response_model=PatientRead)
async def get_patient(
    patient_id: str,
    user: CurrentUser = require_permission("patients.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.get_patient(patient_id, user.clinic_id, session)


@router.post("", response_model=PatientRead, status_code=status.HTTP_201_CREATED)
async def create_patient(
    data: PatientCreate,
    user: CurrentUser = require_permission("patients.create"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.create_patient(user.clinic_id, data, session)


@router.patch("/{patient_id}", response_model=PatientRead)
async def update_patient(
    patient_id: str,
    data: PatientUpdate,
    user: CurrentUser = require_permission("patients.edit"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.update_patient(patient_id, user.clinic_id, data, session)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: str,
    user: CurrentUser = require_permission("patients.edit"),
    session: AsyncSession = Depends(get_db),
):
    await crud.delete_patient(patient_id, user.clinic_id, session)


@router.post("/{patient_id}/photo")
async def upload_patient_photo(
    patient_id: str,
    file: UploadFile = File(...),
    user: CurrentUser = require_permission("patients.edit"),
    session: AsyncSession = Depends(get_db),
):
    if file.content_type not in _ALLOWED_PHOTO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Solo se permiten imágenes (PNG, JPEG, WebP)",
        )
    await set_rls_context(session, user.clinic_id)
    check = await session.execute(
        text("SELECT 1 FROM patients WHERE id = :id AND deleted_at IS NULL"),
        {"id": patient_id},
    )
    if check.scalar() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mascota no encontrada")

    content = await file.read()
    unique_name = f"{uuid.uuid4()}_{file.filename}"
    key = patient_photo_key(user.clinic_id, patient_id, unique_name)
    file_url = await asyncio.to_thread(upload_file, content, key, file.content_type)

    await session.execute(
        text("UPDATE patients SET photo_url = :url WHERE id = :id"),
        {"url": file_url, "id": patient_id},
    )
    await session.commit()
    return {"photo_url": file_url}
