from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class VaccinationRead(BaseModel):
    id: UUID
    clinic_id: UUID
    patient_id: UUID
    medical_record_id: UUID | None
    vaccine_name: str
    applied_at: date
    next_dose_at: date | None
    batch_number: str | None
    created_at: datetime


class VaccinationCreate(BaseModel):
    vaccine_name: str
    applied_at: date
    next_dose_at: date | None = None
    batch_number: str | None = None


class AttachmentRead(BaseModel):
    id: UUID
    clinic_id: UUID
    medical_record_id: UUID
    file_url: str
    file_name: str
    file_type: str | None
    created_at: datetime


class MedicalRecordRead(BaseModel):
    id: UUID
    clinic_id: UUID
    patient_id: UUID
    patient_name: str
    veterinarian_id: UUID
    veterinarian_name: str
    appointment_id: UUID | None
    reason: str
    diagnosis: str | None
    treatment: str | None
    prescriptions: str | None
    weight: Decimal | None
    temperature: Decimal | None
    visit_date: datetime
    created_at: datetime
    vaccinations: list[VaccinationRead] = []
    attachments: list[AttachmentRead] = []


class MedicalRecordCreate(BaseModel):
    patient_id: str
    appointment_id: str | None = None
    reason: str
    diagnosis: str | None = None
    treatment: str | None = None
    prescriptions: str | None = None
    weight: Decimal | None = None
    temperature: Decimal | None = None
    visit_date: datetime | None = None
    vaccinations: list[VaccinationCreate] = []


class MedicalRecordUpdate(BaseModel):
    reason: str | None = None
    diagnosis: str | None = None
    treatment: str | None = None
    prescriptions: str | None = None
    weight: Decimal | None = None
    temperature: Decimal | None = None
    visit_date: datetime | None = None
