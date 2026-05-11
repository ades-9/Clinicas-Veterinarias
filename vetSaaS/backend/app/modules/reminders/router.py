from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.core.permissions import require_permission
from app.modules.reminders import crud
from app.modules.reminders.schemas import MarkRemindedRequest, UpcomingReminderRead

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("/upcoming", response_model=list[UpcomingReminderRead])
async def list_upcoming(
    days_ahead: int = Query(default=30, ge=1, le=365),
    user: CurrentUser = require_permission("medical_records.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.list_upcoming(user.clinic_id, session, days_ahead=days_ahead)


@router.post("/sent", status_code=http_status.HTTP_204_NO_CONTENT)
async def mark_reminded(
    data: MarkRemindedRequest,
    user: CurrentUser = require_permission("medical_records.edit"),
    session: AsyncSession = Depends(get_db),
):
    await crud.mark_reminded(user.clinic_id, data, session)
