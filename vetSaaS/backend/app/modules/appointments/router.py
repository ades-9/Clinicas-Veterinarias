from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http_status
from fastapi import Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db
from app.core.permissions import check_permission, require_permission
from app.modules.appointments import crud
from app.modules.appointments.schemas import (
    AppointmentCreate,
    AppointmentRead,
    AppointmentServiceCreate,
    AppointmentServiceRead,
    AppointmentServiceUpdate,
    AppointmentUpdate,
)

services_router = APIRouter(prefix="/appointment-services", tags=["appointments"])
router = APIRouter(prefix="/appointments", tags=["appointments"])


# ---- appointment services ----

@services_router.get("", response_model=list[AppointmentServiceRead])
async def list_services(
    user: CurrentUser = require_permission("appointments.view_all"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.list_services(user.clinic_id, session)


@services_router.post("", response_model=AppointmentServiceRead, status_code=http_status.HTTP_201_CREATED)
async def create_service(
    data: AppointmentServiceCreate,
    user: CurrentUser = require_permission("appointments.create"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.create_service(user.clinic_id, data, session)


@services_router.patch("/{service_id}", response_model=AppointmentServiceRead)
async def update_service(
    service_id: str,
    data: AppointmentServiceUpdate,
    user: CurrentUser = require_permission("appointments.edit"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.update_service(service_id, user.clinic_id, data, session)


@services_router.delete("/{service_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: str,
    user: CurrentUser = require_permission("appointments.edit"),
    session: AsyncSession = Depends(get_db),
):
    await crud.delete_service(service_id, user.clinic_id, session)


# ---- appointments ----

@router.get("", response_model=list[AppointmentRead])
async def list_appointments(
    appointment_status: str | None = Query(default=None, alias="status"),
    service_type: str | None = Query(default=None),
    patient_id: str | None = Query(default=None),
    assigned_user_id: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    can_view_all = user.role == "superadmin" or await check_permission("appointments.view_all", user, session)
    can_view_own = await check_permission("appointments.view_own", user, session)

    if not can_view_all and not can_view_own:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Permiso requerido: appointments.view_all o appointments.view_own",
        )

    only_own = None if can_view_all else user.user_id

    return await crud.list_appointments(
        user.clinic_id,
        session,
        appointment_status=appointment_status,
        service_type=service_type,
        patient_id=patient_id,
        assigned_user_id=assigned_user_id,
        date_from=date_from,
        date_to=date_to,
        only_own_clerk_id=only_own,
        limit=limit,
        offset=offset,
    )


@router.get("/{appointment_id}", response_model=AppointmentRead)
async def get_appointment(
    appointment_id: str,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    can_view_all = user.role == "superadmin" or await check_permission("appointments.view_all", user, session)
    can_view_own = await check_permission("appointments.view_own", user, session)

    if not can_view_all and not can_view_own:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Permiso requerido: appointments.view_all o appointments.view_own",
        )
    only_own = None if can_view_all else user.user_id
    return await crud.get_appointment(appointment_id, user.clinic_id, session, only_own_clerk_id=only_own)


@router.post("", response_model=AppointmentRead, status_code=http_status.HTTP_201_CREATED)
async def create_appointment(
    data: AppointmentCreate,
    user: CurrentUser = require_permission("appointments.create"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.create_appointment(user.clinic_id, data, session)


@router.patch("/{appointment_id}", response_model=AppointmentRead)
async def update_appointment(
    appointment_id: str,
    data: AppointmentUpdate,
    user: CurrentUser = require_permission("appointments.edit"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.update_appointment(appointment_id, user.clinic_id, data, session)


@router.delete("/{appointment_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def cancel_appointment(
    appointment_id: str,
    user: CurrentUser = require_permission("appointments.cancel"),
    session: AsyncSession = Depends(get_db),
):
    await crud.cancel_appointment(appointment_id, user.clinic_id, session)
