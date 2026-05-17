# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VetSaaS is a multi-tenant SaaS platform for veterinary clinic management (medical records, appointments, reminders, inventory, sales, reporting). It follows a 5-phase roadmap documented in `VetSaaS_Plan_Desarrollo.docx`.

## Commands

### Backend (FastAPI)
```bash
cd vetSaaS/backend

# Install dependencies
pip install -r requirements.txt

# Run dev server
uvicorn app.main:app --reload --port 8000

# Database migrations
alembic upgrade head          # apply all migrations
alembic downgrade -1          # rollback one
# New migration: create the file manually as alembic/versions/NNN_short_description.py
# with the next sequential number. Do NOT use --autogenerate; it fights with RLS.

# Tests
pytest
pytest tests/path/to/test_file.py::test_name  # single test
```

### Frontend (React/Vite)
```bash
cd vetSaaS/frontend

# Install dependencies
npm install

# Dev server (proxies /api → backend)
npm run dev

# Build
npm run build
```

## Architecture

### Multi-tenancy
Every request is scoped to a `clinic_id`. PostgreSQL Row Level Security (RLS) enforces isolation at the database layer — the backend sets a session variable (`app.clinic_id`) and RLS policies filter all queries automatically. Never bypass this by filtering manually in queries.

### Authentication & Authorization
- **Auth:** Clerk handles identity. Backend verifies JWTs via JWKS (`app/core/auth.py`). The `get_current_user` dependency decodes the token and returns a `CurrentUser` with `user_id`, `clinic_id`, and `role`.
- **Permissions:** Permissions are stored in the DB per role+action (not hardcoded). Use the `require_permission(action)` decorator on endpoints. Module activation is also checked via `clinic_modules` table.

### Module Structure
Each feature lives in `app/modules/<feature>/` with this layout:
```
schemas.py   # Pydantic models (Create, Update, Response)
crud.py      # Async DB operations, always receive AsyncSession + clinic_id
router.py    # FastAPI router, uses auth dependencies and permission decorator
register.py  # (optional) router registration helper
```
Register routers in `app/main.py`.

### Database Conventions
- **Soft delete** on every table via `deleted_at TIMESTAMP NULL`. Never issue `DELETE`. Filter with `WHERE deleted_at IS NULL`.
- **clinic_id** foreign key on every tenant-scoped table.
- **Alembic** for all schema changes — never alter tables manually.
- Use `AsyncSession` everywhere; no sync DB calls.

### Storage
Cloudflare R2 (S3-compatible) via boto3. Helpers in `app/core/storage.py` return the canonical key (`clinic_logo_key`, `patient_photo_key`, `vaccination_photo_key`, etc.) — use them, don't hand-build keys. Keys follow the pattern `clinics/{clinic_id}/{record_type}/{filename}`.

**Image upload endpoint pattern** (e.g. patient photo, vaccination photo, clinic logo):
1. Validate `file.content_type in _ALLOWED_IMAGE_TYPES`.
2. `content = await file.read()`.
3. `url = await asyncio.to_thread(upload_file, content, key, file.content_type)`.
4. Update the DB column with the returned URL and return the updated record.

### CRUD column-list constants
Each module's `crud.py` declares column-list constants (`_PATIENT_SELECT`, `_VACCINATION_COLS`, `_VACC_INSERT_COLS`, `_VACC_INSERT_PARAMS`, `_SURGERY_RETURNING`, etc.). When adding a column, update **every** matching constant — missing one silently drops the field from a SELECT or INSERT and the bug only surfaces at runtime.

### Service types — naming gotcha
`ServiceType = "veterinary" | "grooming" | "aesthetic"`. The third value used to be called `"promotional"` and was renamed. Do **not** reintroduce `"promotional"` in code, types, or DB enums.

### Frontend conventions

**TanStack Query keys** — stable shapes so invalidation works across components:
- `["patient", id]`, `["patients"]`
- `["patient-vaccinations", patientId]`, `["patient-dewormings", patientId]`, `["patient-surgeries", patientId]`
- `["medical-records", patientId]`
- `["configuration"]`, `["owners"]`, `["appointment-services"]`, `["catalog-species"]`, `["catalog-breeds", speciesId]`, `["catalog-vaccine-types", speciesId]`

After a mutation, invalidate **every** related key — e.g. uploading a patient photo invalidates both `["patient", id]` and `["patients"]`.

**Draft pattern in dialogs.** `VaccinationDialog` / `DewormingDialog` / `SurgeryDialog` accept an optional `onSubmitDraft` prop. When present, they call it with the form payload instead of POSTing — used by `ConsultationModal` to batch new vaccines/dewormings/surgeries that should be persisted alongside a medical record. When absent, the dialog POSTs directly to `/patients/:id/(vaccinations|dewormings|surgeries)`.

**Printable pages** (e.g. `PatientCarnetPage` at `/patients/:id/carnet`) are routed **outside** `AppLayout` to avoid sidebar/topbar chrome, and use `@media print` + `break-inside-avoid` for clean A4 output.

**UI primitives** live in `@/components/ui/` (Button, Dialog, Input, Label, Select, Textarea, Badge). Extend these — don't introduce a parallel component library.

### Dev environment (Windows)
- Default shell is PowerShell, not bash — chain commands with `;`, not `&&`.
- `npm run dev` proxies `/api/v1/*` to `http://localhost:8000` (see `vite.config.ts`); both servers must be running.
- `WinError 10013` when starting uvicorn means another process holds port 8000 or Windows has reserved the range — kill the offending process or pick another port; don't disable network checks.

### Key env vars
Backend (`.env`): `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_JWKS_URL`, `R2_*`, `RESEND_API_KEY`, `ENVIRONMENT`.  
Frontend (`.env`): `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL`.

## Irrevocable Architecture Decisions
- Multi-tenancy via `clinic_id` + PostgreSQL RLS — never per-tenant schemas.
- Soft delete (`deleted_at`) everywhere — no physical `DELETE`.
- Permissions stored in DB per role+action — never hardcode roles in code.
- Modules activatable per clinic via `clinic_modules` table.
- Alembic for all migrations.
