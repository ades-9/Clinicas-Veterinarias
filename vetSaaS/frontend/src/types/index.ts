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

export type UserArea = "veterinary" | "grooming" | "aesthetic"

export interface User {
  id: string
  clinic_id: string
  role_id: string
  role_name: string
  clerk_user_id: string
  full_name: string
  email: string
  is_active: boolean
  areas: UserArea[]
  created_at: string
}

export type PreferredContact = "whatsapp" | "sms" | "email" | "phone"

export type ReminderKind = "vaccine" | "deworming"
export type ReminderType = "appointment_24h" | "vaccine_due" | "deworming_due"

export interface UpcomingReminder {
  kind: ReminderKind
  patient_id: string
  patient_name: string
  owner_id: string
  owner_name: string
  owner_phone: string | null
  owner_email: string | null
  owner_preferred_contact: PreferredContact | null
  label: string
  manufacturer: string | null
  applied_at: string
  next_dose_at: string
  days_from_today: number
  last_reminded_at: string | null
}

export interface Owner {
  id: string
  clinic_id: string
  full_name: string
  id_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  preferred_contact: PreferredContact | null
  created_at: string
}

export interface OwnersList {
  items: Owner[]
  total: number
}

export interface PatientsList {
  items: Patient[]
  total: number
}

export interface AppointmentsList {
  items: Appointment[]
  total: number
}

export interface ProductsList {
  items: Product[]
  total: number
}

export interface StockMovementsList {
  items: StockMovement[]
  total: number
}

export interface SalesList {
  items: Sale[]
  total: number
}

export type PatientSex = "male" | "female"

export interface Patient {
  id: string
  clinic_id: string
  owner_id: string
  owner_name: string
  name: string
  species_id: string | null
  species_name: string | null
  breed_id: string | null
  breed_name: string | null
  birth_date: string | null
  weight: number | null
  sex: PatientSex | null
  is_sterilized: boolean | null
  color: string | null
  microchip_number: string | null
  distinctive_marks: string | null
  allergies: string | null
  chronic_conditions: string | null
  temperament_notes: string | null
  lifestyle_notes: string | null
  grooming_preferences: string | null
  vaccination_code: string | null
  photo_url: string | null
  notes: string | null
  created_at: string
}

export type ServiceType = "veterinary" | "grooming" | "aesthetic"
export type AppointmentStatus = "pending" | "confirmed" | "attended" | "cancelled"

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  veterinary: "Veterinaria",
  grooming: "Peluquería",
  aesthetic: "Estética",
}

export interface AppointmentService {
  id: string
  clinic_id: string
  name: string
  service_type: ServiceType
  duration_minutes: number
  price: number
  promo_price: number | null
  promo_start: string | null
  promo_end: string | null
  effective_price: number
  is_promotional: boolean
  created_at: string
}

export interface Species {
  id: string
  name: string
}

export interface Breed {
  id: string
  species_id: string
  name: string
}

export interface ProductUnit {
  id: string
  name: string
}

export interface VaccineType {
  id: string
  name: string
  species_id: string | null
  description: string | null
  recommended_revaccination_months: number | null
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
  service_type: ServiceType  // área (común a todos los servicios de la cita)
  services: AppointmentService[]
  total_duration_minutes: number
  scheduled_at: string
  status: AppointmentStatus
  notes: string | null
  is_emergency: boolean
  created_at: string
}

export interface Vaccination {
  id: string
  clinic_id: string
  patient_id: string
  medical_record_id: string | null
  vaccine_type_id: string | null
  vaccine_name: string
  manufacturer: string | null
  applied_at: string
  next_dose_at: string | null
  batch_number: string | null
  expiration_date: string | null
  weight_at_application: number | null
  photo_url: string | null
  applied_externally: boolean
  external_clinic_name: string | null
  created_at: string
}

export type DewormingType = "internal" | "external" | "both"

export interface Deworming {
  id: string
  clinic_id: string
  patient_id: string
  medical_record_id: string | null
  product_name: string
  manufacturer: string | null
  treatment_type: DewormingType
  applied_at: string
  next_dose_at: string | null
  weight_at_application: number | null
  batch_number: string | null
  expiration_date: string | null
  notes: string | null
  photo_url: string | null
  applied_externally: boolean
  external_clinic_name: string | null
  created_at: string
}

export interface Surgery {
  id: string
  clinic_id: string
  patient_id: string
  medical_record_id: string | null
  name: string
  performed_at: string
  veterinarian_name: string | null
  description: string | null
  complications: string | null
  applied_externally: boolean
  external_clinic_name: string | null
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
  appointment_service_type: ServiceType | null
  reason: string
  diagnosis: string | null
  treatment: string | null
  prescriptions: string | null
  weight: number | null
  temperature: number | null
  heart_rate: number | null
  respiratory_rate: number | null
  pulse: string | null
  physical_exam: string | null
  visit_date: string
  created_at: string
  vaccinations: Vaccination[]
  dewormings: Deworming[]
  surgeries: Surgery[]
  prescription_items: PrescriptionItem[]
  attachments: Attachment[]
}

export interface ProductCategory {
  id: string
  clinic_id: string
  name: string
  created_at: string
}

export interface Product {
  id: string
  clinic_id: string
  category_id: string | null
  category_name: string | null
  name: string
  description: string | null
  sku: string | null
  unit: string
  price: number
  cost: number | null
  stock: number
  min_stock: number
  is_active: boolean
  is_medication: boolean
  created_at: string
}

export interface PrescriptionItem {
  id: string
  clinic_id: string
  medical_record_id: string
  product_id: string | null
  product_name: string | null
  custom_name: string | null
  dose: string | null
  frequency: string | null
  duration: string | null
  notes: string | null
  created_at: string
}

export type MovementType = "entry" | "exit" | "adjustment"

export interface StockMovement {
  id: string
  clinic_id: string
  product_id: string
  product_name: string
  user_id: string | null
  movement_type: MovementType
  quantity: number
  reason: string | null
  created_at: string
}

export interface SaleItem {
  id: string
  clinic_id: string
  sale_id: string
  product_id: string | null
  service_id: string | null
  item_name: string
  quantity: number
  unit_price: number
  subtotal: number
  professional_user_id: string | null
  professional_name: string | null
}

export interface ProfessionalMetrics {
  user_id: string
  full_name: string
  role_name: string
  appointments_attended: number
  appointments_cancelled: number
  consultations_count: number
  services_sold: number
  products_sold: number
  revenue_total: number
  revenue_veterinary: number
  revenue_grooming: number
  revenue_aesthetic: number
}

export interface ProfessionalPerformanceReport {
  date_from: string
  date_to: string
  professionals: ProfessionalMetrics[]
}

export type SaleStatus = "pending" | "completed" | "cancelled"

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  pending: "Pendiente",
  completed: "Cobrada",
  cancelled: "Cancelada",
}

export interface Sale {
  id: string
  clinic_id: string
  user_id: string | null
  appointment_id: string | null
  patient_id: string | null
  patient_name: string | null
  owner_id: string | null
  owner_name: string | null
  status: SaleStatus
  total: number
  notes: string | null
  created_at: string
  items: SaleItem[]
}
