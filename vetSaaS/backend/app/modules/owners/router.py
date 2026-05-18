import io
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.core.permissions import require_permission
from app.modules.owners import crud
from app.modules.owners.schemas import OwnerCreate, OwnerRead, OwnersList, OwnerUpdate

router = APIRouter(prefix="/owners", tags=["owners"])


@router.get("", response_model=OwnersList)
async def list_owners(
    q: str | None = Query(default=None, description="Buscar por nombre, email, teléfono o documento"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = require_permission("owners.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.list_owners(user.clinic_id, session, q=q, limit=limit, offset=offset)


_OWNER_EXPORT_HEADERS = [
    "Nombre", "Documento", "Teléfono", "Email",
    "Dirección", "Contacto preferido", "Fecha registro",
]
_PREFERRED_CONTACT_LABELS = {
    "whatsapp": "WhatsApp",
    "sms": "SMS",
    "email": "Email",
    "phone": "Llamada",
}


def _owner_row(o: OwnerRead) -> list:
    return [
        o.full_name,
        o.id_number or "",
        o.phone or "",
        o.email or "",
        o.address or "",
        _PREFERRED_CONTACT_LABELS.get(o.preferred_contact or "", "") if o.preferred_contact else "",
        o.created_at.strftime("%Y-%m-%d"),
    ]


@router.get("/export.xlsx")
async def export_owners_xlsx(
    q: str | None = Query(default=None),
    user: CurrentUser = require_permission("owners.view"),
    session: AsyncSession = Depends(get_db),
):
    from openpyxl import Workbook

    owners = await crud.list_all_owners_for_export(user.clinic_id, session, q=q)
    wb = Workbook()
    ws = wb.active
    ws.title = "Propietarios"
    ws.append(_OWNER_EXPORT_HEADERS)
    for o in owners:
        ws.append(_owner_row(o))
    for col_idx, header in enumerate(_OWNER_EXPORT_HEADERS, start=1):
        ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = max(len(header) + 4, 18)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"propietarios_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export.pdf")
async def export_owners_pdf(
    q: str | None = Query(default=None),
    user: CurrentUser = require_permission("owners.view"),
    session: AsyncSession = Depends(get_db),
):
    from weasyprint import HTML

    owners = await crud.list_all_owners_for_export(user.clinic_id, session, q=q)
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    rows_html = "".join(
        "<tr>" + "".join(f"<td>{_html_escape(c)}</td>" for c in _owner_row(o)) + "</tr>"
        for o in owners
    )
    headers_html = "".join(f"<th>{h}</th>" for h in _OWNER_EXPORT_HEADERS)
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
            <h1>Propietarios</h1>
            <div class="meta">Generado: {generated_at} &middot; Total: {len(owners)}</div>
            <table>
                <thead><tr>{headers_html}</tr></thead>
                <tbody>{rows_html}</tbody>
            </table>
        </body>
        </html>
    """
    pdf_bytes = HTML(string=html_doc).write_pdf()
    filename = f"propietarios_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _html_escape(v) -> str:
    s = str(v) if v is not None else ""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


@router.get("/{owner_id}", response_model=OwnerRead)
async def get_owner(
    owner_id: str,
    user: CurrentUser = require_permission("owners.view"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.get_owner(owner_id, user.clinic_id, session)


@router.post("", response_model=OwnerRead, status_code=status.HTTP_201_CREATED)
async def create_owner(
    data: OwnerCreate,
    user: CurrentUser = require_permission("owners.create"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.create_owner(user.clinic_id, data, session)


@router.patch("/{owner_id}", response_model=OwnerRead)
async def update_owner(
    owner_id: str,
    data: OwnerUpdate,
    user: CurrentUser = require_permission("owners.edit"),
    session: AsyncSession = Depends(get_db),
):
    return await crud.update_owner(owner_id, user.clinic_id, data, session)


@router.delete("/{owner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_owner(
    owner_id: str,
    user: CurrentUser = require_permission("owners.edit"),
    session: AsyncSession = Depends(get_db),
):
    await crud.delete_owner(owner_id, user.clinic_id, session)
