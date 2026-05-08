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
  species_id: string | null
  species_name: string | null
  breed_id: string | null
  breed_name: string | null
  birth_date: string | null
  weight: number | null
  vaccination_code: string | null
  notes: string | null
  created_at: string
}

export type ServiceType = "veterinary" | "grooming" | "promotional"
export type AppointmentStatus = "pending" | "confirmed" | "attended" | "cancelled"

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
  total: number
  notes: string | null
  created_at: string
  items: SaleItem[]
}
