from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

DewormingType = Literal["internal", "external", "both"]


class VaccinationRead(BaseModel):
    id: UUID
    clinic_id: UUID
    patient_id: UUID
    medical_record_id: UUID | None
    vaccine_type_id: UUID | None
    vaccine_name: str
    manufacturer: str | None
    applied_at: date
    next_dose_at: date | None
    batch_number: str | None
    expiration_date: date | None
    weight_at_application: Decimal | None
    photo_url: str | None
    applied_externally: bool
    external_clinic_name: str | None
    created_at: datetime


class VaccinationCreate(BaseModel):
    vaccine_type_id: str | None = None
    vaccine_name: str
    manufacturer: str | None = None
    applied_at: date
    next_dose_at: date | None = None
    batch_number: str | None = None
    expiration_date: date | None = None
    weight_at_application: Decimal | None = None
    applied_externally: bool = False
    external_clinic_name: str | None = None


class DewormingRead(BaseModel):
    id: UUID
    clinic_id: UUID
    patient_id: UUID
    medical_record_id: UUID | None
    product_name: str
    manufacturer: str | None
    treatment_type: DewormingType
    applied_at: date
    next_dose_at: date | None
    weight_at_application: Decimal | None
    batch_number: str | None
    expiration_date: date | None
    notes: str | None
    photo_url: str | None
    applied_externally: bool
    external_clinic_name: str | None
    created_at: datetime


class DewormingCreate(BaseModel):
    product_name: str
    manufacturer: str | None = None
    treatment_type: DewormingType
    applied_at: date
    next_dose_at: date | None = None
    weight_at_application: Decimal | None = None
    batch_number: str | None = None
    expiration_date: date | None = None
    notes: str | None = None
    applied_externally: bool = False
    external_clinic_name: str | None = None


class SurgeryRead(BaseModel):
    id: UUID
    clinic_id: UUID
    patient_id: UUID
    medical_record_id: UUID | None
    name: str
    performed_at: date
    veterinarian_name: str | None
    description: str | None
    complications: str | None
    applied_externally: bool
    external_clinic_name: str | None
    created_at: datetime


class SurgeryCreate(BaseModel):
    name: str
    performed_at: date
    veterinarian_name: str | None = None
    description: str | None = None
    complications: str | None = None
    applied_externally: bool = False
    external_clinic_name: str | None = None


class PrescriptionItemRead(BaseModel):
    id: UUID
    clinic_id: UUID
    medical_record_id: UUID
    product_id: UUID | None
    product_name: str | None  # del JOIN
    custom_name: str | None
    dose: str | None
    frequency: str | None
    duration: str | None
    notes: str | None
    created_at: datetime


class PrescriptionItemCreate(BaseModel):
    product_id: str | None = None
    custom_name: str | None = None
    dose: str | None = None
    frequency: str | None = None
    duration: str | None = None
    notes: str | None = None


class AttachmentRead(BaseModel):
    id: UUID
    clinic_id: UUID
    medical_record_id: UUID
    file_url: str
    file_name: str
    file_type: str | None
    created_at: datetime


ServiceArea = Literal["veterinary", "grooming", "aesthetic"]


class MedicalRecordRead(BaseModel):
    id: UUID
    clinic_id: UUID
    patient_id: UUID
    patient_name: str
    veterinarian_id: UUID
    veterinarian_name: str
    appointment_id: UUID | None
    appointment_service_type: ServiceArea | None  # área de la cita asociada (si existe)
    reason: str
    diagnosis: str | None
    treatment: str | None
    prescriptions: str | None
    weight: Decimal | None
    temperature: Decimal | None
    heart_rate: int | None
    respiratory_rate: int | None
    pulse: str | None
    physical_exam: str | None
    visit_date: datetime
    created_at: datetime
    vaccinations: list[VaccinationRead] = []
    dewormings: list[DewormingRead] = []
    surgeries: list[SurgeryRead] = []
    prescription_items: list[PrescriptionItemRead] = []
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
    heart_rate: int | None = None
    respiratory_rate: int | None = None
    pulse: str | None = None
    physical_exam: str | None = None
    visit_date: datetime | None = None
    vaccinations: list[VaccinationCreate] = []
    prescription_items: list[PrescriptionItemCreate] = []


class MedicalRecordUpdate(BaseModel):
    reason: str | None = None
    diagnosis: str | None = None
    treatment: str | None = None
    prescriptions: str | None = None
    weight: Decimal | None = None
    temperature: Decimal | None = None
    heart_rate: int | None = None
    respiratory_rate: int | None = None
    pulse: str | None = None
    physical_exam: str | None = None
    visit_date: datetime | None = None
