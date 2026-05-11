from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.core.permissions import require_permission
from app.modules.reports import crud
from app.modules.reports.schemas import ProfessionalPerformanceReport

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/professional-performance", response_model=ProfessionalPerformanceReport)
async def professional_performance(
    date_from: date = Query(...),
    date_to: date = Query(...),
    user: CurrentUser = require_permission("reports.view_general"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.professional_performance(user.clinic_id, session, date_from, date_to)
