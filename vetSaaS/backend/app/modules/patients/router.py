import asyncio
import io
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db, set_rls_context
from app.core.permissions import require_permission
from app.core.storage import patient_photo_key, upload_file
from app.modules.patients import crud
from app.modules.patients.schemas import PatientCreate, PatientRead, PatientsList, PatientUpdate

router = APIRouter(prefix="/patients", tags=["patients"])

_ALLOWED_PHOTO_TYPES = {"image/png", "image/jpeg", "image/webp"}


@router.get("", response_model=PatientsList)
async def list_patients(
    q: str | None = Query(default=None, description="Buscar por nombre del paciente, dueño o código de vacuna"),
    owner_id: str | None = Query(default=None, description="Filtrar por propietario"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = require_permission("patients.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.list_patients(user.clinic_id, session, q=q, owner_id=owner_id, limit=limit, offset=offset)


_PATIENT_EXPORT_HEADERS = [
    "Nombre", "Propietario", "Especie", "Raza", "Sexo",
    "Fecha nacimiento", "Peso (kg)", "Microchip", "Código vacuna", "Fecha registro",
]
_SEX_LABELS = {"male": "Macho", "female": "Hembra"}


def _patient_row(p: PatientRead) -> list:
    return [
        p.name,
        p.owner_name,
        p.species_name or "",
        p.breed_name or "",
        _SEX_LABELS.get(p.sex or "", "") if p.sex else "",
        p.birth_date.strftime("%Y-%m-%d") if p.birth_date else "",
        f"{p.weight:.2f}" if p.weight is not None else "",
        p.microchip_number or "",
        p.vaccination_code or "",
        p.created_at.strftime("%Y-%m-%d"),
    ]


@router.get("/export.xlsx")
async def export_patients_xlsx(
    q: str | None = Query(default=None),
    owner_id: str | None = Query(default=None),
    user: CurrentUser = require_permission("patients.view"),
    session: AsyncSession = Depends(get_db),
):
    from openpyxl import Workbook

    patients = await crud.list_all_patients_for_export(user.clinic_id, session, q=q, owner_id=owner_id)
    wb = Workbook()
    ws = wb.active
    ws.title = "Mascotas"
    ws.append(_PATIENT_EXPORT_HEADERS)
    for p in patients:
        ws.append(_patient_row(p))
    for col_idx, header in enumerate(_PATIENT_EXPORT_HEADERS, start=1):
        ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = max(len(header) + 4, 18)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"mascotas_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export.pdf")
async def export_patients_pdf(
    q: str | None = Query(default=None),
    owner_id: str | None = Query(default=None),
    user: CurrentUser = require_permission("patients.view"),
    session: AsyncSession = Depends(get_db),
):
    from weasyprint import HTML

    patients = await crud.list_all_patients_for_export(user.clinic_id, session, q=q, owner_id=owner_id)
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    rows_html = "".join(
        "<tr>" + "".join(f"<td>{_html_escape(c)}</td>" for c in _patient_row(p)) + "</tr>"
        for p in patients
    )
    headers_html = "".join(f"<th>{h}</th>" for h in _PATIENT_EXPORT_HEADERS)
    html_doc = f"""
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                @page {{ size: A4 landscape; margin: 12mm; }}
                body {{ font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: #1f2937; }}
                h1 {{ font-size: 14pt; margin: 0 0 4px; }}
                .meta {{ font-size: 8pt; color: #6b7280; margin-bottom: 12px; }}
                table {{ width: 100%; border-collapse: collapse; }}
                th, td {{ border: 1px solid #e5e7eb; padding: 4px 6px; text-align: left; }}
                th {{ background: #f3f4f6; font-weight: 600; }}
                tr:nth-child(even) td {{ background: #fafafa; }}
            </style>
        </head>
        <body>
            <h1>Mascotas</h1>
            <div class="meta">Generado: {generated_at} &middot; Total: {len(patients)}</div>
            <table>
                <thead><tr>{headers_html}</tr></thead>
                <tbody>{rows_html}</tbody>
            </table>
        </body>
        </html>
    """
    pdf_bytes = HTML(string=html_doc).write_pdf()
    filename = f"mascotas_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _html_escape(v) -> str:
    s = str(v) if v is not None else ""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


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
