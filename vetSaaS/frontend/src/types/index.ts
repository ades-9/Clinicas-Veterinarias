export interface Clinic {
  id: string
  name: string
  phone: string | null
  address: string | null
  email: string | null
  tax_id: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
}

export interface Role {
  id: string
  name: string
}

export interface User {
  id: string
  clinic_id: string
  role_id: string
  role_name: string
  clerk_user_id: string
  full_name: string
  email: string
  is_active: boolean
  created_at: string
}

export interface Owner {
  id: string
  clinic_id: string
  full_name: string
  id_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  created_at: string
}

export interface Patient {
  id: string
  clinic_id: string
  owner_id: string
  owner_name: string
  name: string
  species: string | null
  breed: string | null
  birth_date: string | null
  weight: number | null
  vaccination_code: string | null
  notes: string | null
  created_at: string
}

export type ServiceType = "veterinary" | "grooming"
export type AppointmentStatus = "pending" | "confirmed" | "attended" | "cancelled"

export interface AppointmentService {
  id: string
  clinic_id: string
  name: string
  service_type: ServiceType
  duration_minutes: number
  created_at: string
}

export interface Appointment {
  id: string
  clinic_id: string
  patient_id: string
  patient_name: string
  owner_id: string
  owner_name: string
  assigned_user_id: string
  assigned_user_name: string
  service_id: string
  service_name: string
  service_type: ServiceType
  scheduled_at: string
  status: AppointmentStatus
  notes: string | null
  created_at: string
}

export interface Vaccination {
  id: string
  clinic_id: string
  patient_id: string
  medical_record_id: string | null
  vaccine_name: string
  applied_at: string
  next_dose_at: string | null
  batch_number: string | null
  created_at: string
}

export interface Attachment {
  id: string
  clinic_id: string
  medical_record_id: string
  file_url: string
  file_name: string
  file_type: string | null
  created_at: string
}

export interface MedicalRecord {
  id: string
  clinic_id: string
  patient_id: string
  patient_name: string
  veterinarian_id: string
  veterinarian_name: string
  appointment_id: string | null
  reason: string
  diagnosis: string | null
  treatment: string | null
  prescriptions: string | null
  weight: number | null
  temperature: number | null
  visit_date: string
  created_at: string
  vaccinations: Vaccination[]
  attachments: Attachment[]
}
