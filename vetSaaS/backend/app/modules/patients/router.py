from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.core.permissions import require_permission
from app.modules.patients import crud
from app.modules.patients.schemas import PatientCreate, PatientRead, PatientUpdate

router = APIRouter(prefix="/patients", tags=["patients"])


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
