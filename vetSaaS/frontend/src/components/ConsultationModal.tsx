import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Bug, Check, Minus, Pencil, Plus, Scissors, Search, Syringe, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useApiClient } from "@/api/client"
import { DewormingDialog, type DewormingDraftPayload } from "@/components/DewormingDialog"
import { OwnerQuickEditDialog } from "@/components/OwnerQuickEditDialog"
import { PatientQuickEditDialog } from "@/components/PatientQuickEditDialog"
import { ScheduleSurgeryDialog } from "@/components/ScheduleSurgeryDialog"
import { SurgeryDialog, type SurgeryDraftPayload } from "@/components/SurgeryDialog"
import { VaccinationDialog, type VaccinationDraftPayload } from "@/components/VaccinationDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import type { Appointment, AppointmentService, Patient, Product } from "@/types"

// ── Types ─────────────────────────────────────────────────────────────────────

interface CartItem {
  type: "product" | "service"
  id: string
  name: string
  quantity: number
  unit_price: number
}

interface ClinicalState {
  reason: string
  diagnosis: string
  treatment: string
  prescriptions: string
  weight: string
  temperature: string
  heart_rate: string
  respiratory_rate: string
  pulse: string
  physical_exam: string
}

// Drafts persistidos en localStorage (sin los archivos de foto)
interface SerializableVaccination extends Omit<VaccinationDraftPayload, "photoFile"> {}
interface SerializableDeworming extends Omit<DewormingDraftPayload, "photoFile"> {}

interface AppliedVaccination {
  data: SerializableVaccination
  photoFile: File | null
}
interface AppliedDeworming {
  data: SerializableDeworming
  photoFile: File | null
}
interface AppliedSurgery {
  data: SurgeryDraftPayload
}

interface PrescriptionDraft {
  product_id: string | null
  product_name: string | null  // para mostrar el nombre del producto del catálogo
  custom_name: string | null   // para medicamentos no en catálogo
  dose: string
  frequency: string
  duration: string
  notes: string
}

interface Draft {
  step: 1 | 2
  clinical: ClinicalState
  cart: CartItem[]
  saleNotes: string
  appliedVaccinations: SerializableVaccination[]
  appliedDewormings: SerializableDeworming[]
  appliedSurgeries: SurgeryDraftPayload[]
  prescriptionItems: PrescriptionDraft[]
}

const EMPTY_CLINICAL: ClinicalState = {
  reason: "",
  diagnosis: "",
  treatment: "",
  prescriptions: "",
  weight: "",
  temperature: "",
  heart_rate: "",
  respiratory_rate: "",
  pulse: "",
  physical_exam: "",
}

function draftKey(appointmentId: string) {
  return `vet_consultation_${appointmentId}`
}

function loadDraft(appointmentId: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(appointmentId))
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
          done
            ? "bg-primary text-primary-foreground"
            : active
            ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </div>
      <span className={`text-sm ${active ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
    </div>
  )
}

// ── USD formatter ──────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v)

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  appointment: Appointment
  onClose: () => void
  onFinalized: () => void
}

export function ConsultationModal({ appointment, onClose, onFinalized }: Props) {
  const api = useApiClient()
  const qc = useQueryClient()
  const { showSuccess } = useToast()
  const reasonRequired =
    appointment.service_type === "veterinary"
  const DRAFT_KEY = draftKey(appointment.id)

  // Load draft synchronously on first render
  const initialDraft = useRef(loadDraft(appointment.id))
  const hadDraft = useRef(initialDraft.current !== null)

  // Always start at step 1 so the clinical form is always the first screen.
  // Draft data (clinical fields, cart, notes) is still restored.
  const [step, setStep] = useState<1 | 2>(1)
  const [clinical, setClinical] = useState<ClinicalState>(
    initialDraft.current?.clinical ?? EMPTY_CLINICAL
  )
  const [cart, setCart] = useState<CartItem[]>(initialDraft.current?.cart ?? [])
  const [saleNotes, setSaleNotes] = useState(initialDraft.current?.saleNotes ?? "")
  const [showCloseWarning, setShowCloseWarning] = useState(false)
  const [editPatientOpen, setEditPatientOpen] = useState(false)
  const [editOwnerOpen, setEditOwnerOpen] = useState(false)
  const [scheduleSurgeryOpen, setScheduleSurgeryOpen] = useState(false)
  // Items aplicados durante la consulta (acumulados, postean al finalizar)
  const [appliedVaccinations, setAppliedVaccinations] = useState<AppliedVaccination[]>(
    () => (initialDraft.current?.appliedVaccinations ?? []).map((d) => ({ data: d, photoFile: null }))
  )
  const [appliedDewormings, setAppliedDewormings] = useState<AppliedDeworming[]>(
    () => (initialDraft.current?.appliedDewormings ?? []).map((d) => ({ data: d, photoFile: null }))
  )
  const [appliedSurgeries, setAppliedSurgeries] = useState<AppliedSurgery[]>(
    () => (initialDraft.current?.appliedSurgeries ?? []).map((d) => ({ data: d }))
  )
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionDraft[]>(
    () => initialDraft.current?.prescriptionItems ?? []
  )
  // Buscador medicamentos (P — Plan)
  const [medSearch, setMedSearch] = useState("")
  const [debouncedMedSearch, setDebouncedMedSearch] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebouncedMedSearch(medSearch), 250)
    return () => clearTimeout(t)
  }, [medSearch])

  const { data: medsData, isFetching: medsFetching } = useQuery({
    queryKey: ["medications-search", debouncedMedSearch],
    queryFn: () =>
      api.get<{ items: Product[]; total: number }>(
        `/products?limit=20&is_active=true&is_medication=true${
          debouncedMedSearch ? `&q=${encodeURIComponent(debouncedMedSearch)}` : ""
        }`
      ),
    staleTime: 30_000,
  })
  const medications = medsData?.items ?? []
  // Dialogs (modo "aplicado en esta consulta" → onSubmitDraft acumula)
  const [appliedVaccDialogOpen, setAppliedVaccDialogOpen] = useState(false)
  const [appliedDewDialogOpen, setAppliedDewDialogOpen] = useState(false)
  const [appliedSurgDialogOpen, setAppliedSurgDialogOpen] = useState(false)
  // Dialogs (modo "antecedente" → POST inmediato sin record_id)
  const [historyVaccDialogOpen, setHistoryVaccDialogOpen] = useState(false)
  const [historyDewDialogOpen, setHistoryDewDialogOpen] = useState(false)
  const [historySurgDialogOpen, setHistorySurgDialogOpen] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Lazy fetch del paciente para conseguir species_id (filtrar catálogo de vacunas)
  const { data: patientForCatalog } = useQuery({
    queryKey: ["patient", appointment.patient_id],
    queryFn: () => api.get<Patient>(`/patients/${appointment.patient_id}`),
    enabled: appliedVaccDialogOpen || historyVaccDialogOpen,
  })

  // Auto-save draft (sin photoFiles — los archivos no se serializan)
  useEffect(() => {
    const draft: Draft = {
      step,
      clinical,
      cart,
      saleNotes,
      appliedVaccinations: appliedVaccinations.map((v) => v.data),
      appliedDewormings: appliedDewormings.map((d) => d.data),
      appliedSurgeries: appliedSurgeries.map((s) => s.data),
      prescriptionItems,
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [
    step,
    clinical,
    cart,
    saleNotes,
    appliedVaccinations,
    appliedDewormings,
    appliedSurgeries,
    prescriptionItems,
    DRAFT_KEY,
  ])

  // Queries
  const { data: services = [] } = useQuery({
    queryKey: ["appointment-services"],
    queryFn: () => api.get<AppointmentService[]>("/appointment-services"),
    staleTime: 60_000,
  })

  // Búsqueda de productos con debounce
  const [productSearch, setProductSearch] = useState("")
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebouncedProductSearch(productSearch), 250)
    return () => clearTimeout(t)
  }, [productSearch])

  const { data: productsData, isFetching: productsFetching } = useQuery({
    queryKey: ["products-search", debouncedProductSearch],
    queryFn: () =>
      api.get<{ items: Product[]; total: number }>(
        `/products?limit=20&is_active=true&in_stock=true${
          debouncedProductSearch
            ? `&q=${encodeURIComponent(debouncedProductSearch)}`
            : ""
        }`
      ),
    staleTime: 30_000,
    enabled: step === 2,
  })
  const products = productsData?.items ?? []

  // Precargar TODOS los servicios de la cita en el carrito
  useEffect(() => {
    if (services.length === 0) return
    if (appointment.services.length === 0) return
    setCart((prev) => {
      const apptSvcs = appointment.services
        .map((s) => services.find((catalog) => catalog.id === s.id) ?? s)
        .filter((s) => !prev.some((i) => i.type === "service" && i.id === s.id))
      if (apptSvcs.length === 0) return prev
      return [
        ...apptSvcs.map((s) => ({
          type: "service" as const,
          id: s.id,
          name: s.name,
          quantity: 1,
          unit_price: s.effective_price,
        })),
        ...prev,
      ]
    })
  }, [services, appointment.services])

  // Close protection
  function hasContent() {
    if (hadDraft.current) return true
    if (Object.values(clinical).some((v) => v.trim())) return true
    if (cart.some((i) => i.type === "product")) return true
    if (saleNotes.trim()) return true
    if (appliedVaccinations.length > 0) return true
    if (appliedDewormings.length > 0) return true
    if (appliedSurgeries.length > 0) return true
    if (prescriptionItems.length > 0) return true
    return false
  }

  function requestClose() {
    if (hasContent()) {
      setShowCloseWarning(true)
    } else {
      localStorage.removeItem(DRAFT_KEY)
      onClose()
    }
  }

  function confirmDiscard() {
    localStorage.removeItem(DRAFT_KEY)
    onClose()
  }

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cart helpers
  function addProduct(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.type === "product" && i.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.type === "product" && i.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [
        ...prev,
        {
          type: "product",
          id: product.id,
          name: product.name,
          quantity: 1,
          unit_price: product.price,
        },
      ]
    })
  }

  function updateQty(idx: number, delta: number) {
    setCart((prev) =>
      prev
        .map((item, i) => (i === idx ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    )
  }

  function updatePrice(idx: number, value: string) {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) return
    setCart((prev) => prev.map((item, i) => (i === idx ? { ...item, unit_price: num } : item)))
  }

  function removeProduct(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx))
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)

  // Finalize
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (reasonRequired && !clinical.reason.trim()) throw new Error("El motivo de consulta es obligatorio")
      if (cart.length === 0) throw new Error("El carrito no puede estar vacío")

      // 1. Medical record — always created. For grooming sin motivo, usamos el nombre del servicio.
      const reasonValue =
        clinical.reason.trim() || appointment.services.map((s) => s.name).join(" + ")
      const record = await api.post<{ id: string }>("/medical-records", {
        patient_id: appointment.patient_id,
        appointment_id: appointment.id,
        reason: reasonValue,
        diagnosis: clinical.diagnosis || null,
        treatment: clinical.treatment || null,
        prescriptions: clinical.prescriptions || null,
        weight: clinical.weight ? parseFloat(clinical.weight) : null,
        temperature: clinical.temperature ? parseFloat(clinical.temperature) : null,
        heart_rate: clinical.heart_rate ? parseInt(clinical.heart_rate, 10) : null,
        respiratory_rate: clinical.respiratory_rate ? parseInt(clinical.respiratory_rate, 10) : null,
        pulse: clinical.pulse || null,
        physical_exam: clinical.physical_exam || null,
        vaccinations: appliedVaccinations.map((v) => v.data),
        prescription_items: prescriptionItems.map((px) => ({
          product_id: px.product_id,
          custom_name: px.custom_name,
          dose: px.dose || null,
          frequency: px.frequency || null,
          duration: px.duration || null,
          notes: px.notes || null,
        })),
      })

      // 1.b — Vacunas: subir fotos posteriormente. El backend ya creó las vacunas dentro del record;
      // necesitamos sus IDs para subir foto. Como el POST de /medical-records no nos devuelve los IDs
      // de vacunas individuales, usamos un GET del record.
      const haveAnyVaccPhoto = appliedVaccinations.some((v) => v.photoFile)
      if (haveAnyVaccPhoto) {
        const full = await api.get<{ vaccinations: { id: string; vaccine_name: string }[] }>(
          `/medical-records/${record.id}`
        )
        for (const v of appliedVaccinations) {
          if (!v.photoFile) continue
          const match = full.vaccinations.find((r) => r.vaccine_name === v.data.vaccine_name)
          if (!match) continue
          const fd = new FormData()
          fd.append("file", v.photoFile)
          await api.upload<{ photo_url: string }>(
            `/medical-records/vaccinations/${match.id}/photo`,
            fd
          )
        }
      }

      // 1.c — Desparasitaciones aplicadas en esta consulta
      for (const d of appliedDewormings) {
        const created = await api.post<{ id: string }>(
          `/medical-records/${record.id}/dewormings`,
          d.data
        )
        if (d.photoFile) {
          const fd = new FormData()
          fd.append("file", d.photoFile)
          await api.upload<{ photo_url: string }>(
            `/medical-records/dewormings/${created.id}/photo`,
            fd
          )
        }
      }

      // 1.d — Cirugías
      for (const s of appliedSurgeries) {
        await api.post(`/medical-records/${record.id}/surgeries`, s.data)
      }

      // 2. Sale (rendimiento: los items de servicio se asignan al profesional de la cita;
      // los productos quedan sin profesional para que la recepción decida si los asigna)
      await api.post("/sales", {
        appointment_id: appointment.id,
        patient_id: appointment.patient_id,
        owner_id: appointment.owner_id,
        notes: saleNotes || null,
        items: cart.map((i) => ({
          product_id: i.type === "product" ? i.id : null,
          service_id: i.type === "service" ? i.id : null,
          quantity: i.quantity,
          unit_price: i.unit_price,
          professional_user_id:
            i.type === "service" ? appointment.assigned_user_id : null,
        })),
      })

      // 3. Mark appointment attended
      await api.patch(`/appointments/${appointment.id}`, { status: "attended" })
    },
    onSuccess: () => {
      localStorage.removeItem(DRAFT_KEY)
      qc.invalidateQueries({ queryKey: ["appointments"] })
      qc.invalidateQueries({ queryKey: ["appointments-today"] })
      qc.invalidateQueries({ queryKey: ["medical-records"] })
      qc.invalidateQueries({ queryKey: ["sales"] })
      qc.invalidateQueries({ queryKey: ["products"] })
      onFinalized()
      showSuccess("Consulta finalizada")
    },
    onError: (e: Error) => setError(e.message),
  })

  // Backend ya filtra is_active=true y in_stock=true; solo filtramos los que ya están en el carrito.
  const availableProducts = products.filter(
    (p) => !cart.some((i) => i.type === "product" && i.id === p.id)
  )

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={requestClose} />

      <div className="relative bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold">
              Atención — {appointment.patient_name}
            </h2>
            <p className="text-xs text-muted-foreground">
              {appointment.services.map((s) => s.name).join(" + ")} · {appointment.owner_name}
            </p>
          </div>
          <button
            onClick={requestClose}
            className="rounded-md p-1 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Draft banner */}
        {hadDraft.current && !showCloseWarning && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Continuando desde borrador guardado
          </div>
        )}

        {/* Close warning banner */}
        {showCloseWarning && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>El borrador se guardó. ¿Salir y continuar después, o descartar?</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setShowCloseWarning(false)}>
                Continuar aquí
              </Button>
              <Button size="sm" variant="destructive" onClick={confirmDiscard}>
                Descartar y salir
              </Button>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div className="px-6 py-3 border-b flex items-center gap-6 shrink-0">
          <StepDot
            n={1}
            label="Historia clínica"
            active={step === 1}
            done={step > 1}
          />
          <div className="h-px flex-1 bg-border" />
          <StepDot n={2} label="Carrito y finalizar" active={step === 2} done={false} />
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {step === 1 ? (
            <div className="space-y-5">
              {/* Acceso rápido a editar mascota / propietario / programar cirugía */}
              <div className="flex items-center justify-end gap-2 flex-wrap -mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditPatientOpen(true)}
                  title="Actualizar peso, alergias, condiciones crónicas, etc."
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar mascota
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOwnerOpen(true)}
                  title="Actualizar teléfono, email, dirección, canal preferido"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar propietario
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setScheduleSurgeryOpen(true)}
                  title="Crear una nueva cita futura para cirugía"
                >
                  <Scissors className="h-3.5 w-3.5" />
                  Programar cirugía
                </Button>
              </div>

              {/* S — Subjetivo */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  S — Subjetivo (anamnesis)
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="c_reason">Motivo de consulta {reasonRequired && "*"}</Label>
                  <Textarea
                    id="c_reason"
                    rows={2}
                    value={clinical.reason}
                    onChange={(e) => setClinical({ ...clinical, reason: e.target.value })}
                    placeholder={reasonRequired ? "Síntomas descritos por el dueño, duración, antecedentes..." : "Opcional"}
                  />
                </div>
              </div>

              {/* O — Objetivo */}
              <div className="space-y-3 pt-3 border-t">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  O — Objetivo (examen clínico)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="c_weight">Peso (kg)</Label>
                    <Input
                      id="c_weight"
                      type="number"
                      min="0"
                      step="0.01"
                      value={clinical.weight}
                      onChange={(e) => setClinical({ ...clinical, weight: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c_temp">Temperatura (°C)</Label>
                    <Input
                      id="c_temp"
                      type="number"
                      min="0"
                      step="0.1"
                      value={clinical.temperature}
                      onChange={(e) => setClinical({ ...clinical, temperature: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="c_hr">FC (lpm)</Label>
                    <Input
                      id="c_hr"
                      type="number"
                      min="0"
                      value={clinical.heart_rate}
                      onChange={(e) => setClinical({ ...clinical, heart_rate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c_rr">FR (rpm)</Label>
                    <Input
                      id="c_rr"
                      type="number"
                      min="0"
                      value={clinical.respiratory_rate}
                      onChange={(e) => setClinical({ ...clinical, respiratory_rate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c_pulse">Pulso</Label>
                    <Input
                      id="c_pulse"
                      value={clinical.pulse}
                      onChange={(e) => setClinical({ ...clinical, pulse: e.target.value })}
                      placeholder="Ej. fuerte y regular"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c_physical">Examen físico</Label>
                  <Textarea
                    id="c_physical"
                    rows={3}
                    value={clinical.physical_exam}
                    onChange={(e) => setClinical({ ...clinical, physical_exam: e.target.value })}
                    placeholder="Exploración sistemática de órganos y sistemas..."
                  />
                </div>
              </div>

              {/* A — Avalúo */}
              <div className="space-y-3 pt-3 border-t">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  A — Avalúo (diagnóstico)
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="c_diagnosis">Diagnóstico presuntivo o definitivo</Label>
                  <Textarea
                    id="c_diagnosis"
                    rows={2}
                    value={clinical.diagnosis}
                    onChange={(e) => setClinical({ ...clinical, diagnosis: e.target.value })}
                  />
                </div>
              </div>

              {/* P — Plan */}
              <div className="space-y-3 pt-3 border-t">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  P — Plan (tratamiento)
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="c_treatment">Tratamiento</Label>
                  <Textarea
                    id="c_treatment"
                    rows={2}
                    value={clinical.treatment}
                    onChange={(e) => setClinical({ ...clinical, treatment: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prescripciones (medicamentos)</Label>

                  {/* Items prescritos */}
                  {prescriptionItems.length > 0 && (
                    <ul className="space-y-2">
                      {prescriptionItems.map((px, idx) => (
                        <li
                          key={idx}
                          className="rounded-md border bg-muted/30 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                              {px.product_name || px.custom_name}
                              {px.custom_name && !px.product_name && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  (medicamento manual)
                                </span>
                              )}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setPrescriptionItems((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Quitar prescripción"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              placeholder="Dosis"
                              value={px.dose}
                              onChange={(e) =>
                                setPrescriptionItems((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, dose: e.target.value } : p))
                                )
                              }
                            />
                            <Input
                              placeholder="Frecuencia"
                              value={px.frequency}
                              onChange={(e) =>
                                setPrescriptionItems((prev) =>
                                  prev.map((p, i) =>
                                    i === idx ? { ...p, frequency: e.target.value } : p
                                  )
                                )
                              }
                            />
                            <Input
                              placeholder="Duración"
                              value={px.duration}
                              onChange={(e) =>
                                setPrescriptionItems((prev) =>
                                  prev.map((p, i) =>
                                    i === idx ? { ...p, duration: e.target.value } : p
                                  )
                                )
                              }
                            />
                          </div>
                          <Input
                            placeholder="Notas (opcional)"
                            value={px.notes}
                            onChange={(e) =>
                              setPrescriptionItems((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, notes: e.target.value } : p))
                              )
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Buscador */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      className="pl-9"
                      placeholder="Buscar medicamento por nombre, código o categoría..."
                      value={medSearch}
                      onChange={(e) => setMedSearch(e.target.value)}
                    />
                  </div>
                  <div className="rounded-md border divide-y max-h-32 overflow-y-auto">
                    {medsFetching ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground text-center">
                        Buscando...
                      </p>
                    ) : medications.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        {debouncedMedSearch
                          ? "Sin medicamentos en el catálogo."
                          : "No hay medicamentos marcados en el inventario."}{" "}
                        <button
                          type="button"
                          onClick={() =>
                            setPrescriptionItems((prev) => [
                              ...prev,
                              {
                                product_id: null,
                                product_name: null,
                                custom_name: debouncedMedSearch || "Medicamento",
                                dose: "",
                                frequency: "",
                                duration: "",
                                notes: "",
                              },
                            ])
                          }
                          className="text-primary hover:underline"
                        >
                          Agregar manual
                        </button>
                      </div>
                    ) : (
                      medications
                        .filter((p) => !prescriptionItems.some((px) => px.product_id === p.id))
                        .map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => {
                              setPrescriptionItems((prev) => [
                                ...prev,
                                {
                                  product_id: p.id,
                                  product_name: p.name,
                                  custom_name: null,
                                  dose: "",
                                  frequency: "",
                                  duration: "",
                                  notes: "",
                                },
                              ])
                              setMedSearch("")
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/30 text-left"
                          >
                            <span>
                              <span className="font-medium">{p.name}</span>
                              {p.category_name && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  {p.category_name}
                                </span>
                              )}
                            </span>
                            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        ))
                    )}
                  </div>
                </div>
              </div>

              {/* Aplicado en esta consulta — se postea al finalizar atado al record nuevo */}
              <div className="space-y-3 pt-3 border-t">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Aplicado en esta consulta
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAppliedVaccDialogOpen(true)}
                  >
                    <Syringe className="h-3.5 w-3.5" />+ Vacuna
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAppliedDewDialogOpen(true)}
                  >
                    <Bug className="h-3.5 w-3.5" />+ Desparasitación
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAppliedSurgDialogOpen(true)}
                  >
                    <Scissors className="h-3.5 w-3.5" />+ Cirugía
                  </Button>
                </div>
                {(appliedVaccinations.length +
                  appliedDewormings.length +
                  appliedSurgeries.length) > 0 && (
                  <ul className="space-y-1 text-xs">
                    {appliedVaccinations.map((v, idx) => (
                      <li key={`v-${idx}`} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/50">
                        <Syringe className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">
                          <span className="font-medium">{v.data.vaccine_name}</span>
                          {v.data.manufacturer && (
                            <span className="text-muted-foreground ml-2">{v.data.manufacturer}</span>
                          )}
                          {v.photoFile && <span className="text-muted-foreground ml-2">📷</span>}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAppliedVaccinations((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Quitar vacuna"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                    {appliedDewormings.map((d, idx) => (
                      <li key={`d-${idx}`} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/50">
                        <Bug className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">
                          <span className="font-medium">{d.data.product_name}</span>
                          <span className="text-muted-foreground ml-2">
                            ({d.data.treatment_type === "internal"
                              ? "interna"
                              : d.data.treatment_type === "external"
                              ? "externa"
                              : "ambas"})
                          </span>
                          {d.photoFile && <span className="text-muted-foreground ml-2">📷</span>}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAppliedDewormings((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Quitar desparasitación"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                    {appliedSurgeries.map((s, idx) => (
                      <li key={`s-${idx}`} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/50">
                        <Scissors className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">
                          <span className="font-medium">{s.data.name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAppliedSurgeries((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Quitar cirugía"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Antecedentes — se postean al instante (sin record_id) */}
              <div className="space-y-3 pt-3 border-t">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Antecedentes (eventos previos mencionados)
                </p>
                <p className="text-xs text-muted-foreground">
                  Vacunas/desparasitaciones/cirugías hechas antes de esta visita. Se guardan al instante.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryVaccDialogOpen(true)}
                  >
                    <Syringe className="h-3.5 w-3.5" />
                    Antecedente: vacuna
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryDewDialogOpen(true)}
                  >
                    <Bug className="h-3.5 w-3.5" />
                    Antecedente: desparasitación
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setHistorySurgDialogOpen(true)}
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    Antecedente: cirugía
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                ℹ Al cerrar la atención, la venta queda en estado <strong>pendiente de cobro</strong>.
                Recepción puede agregar productos extra (comida, accesorios) antes de cobrarla.
              </div>
              {/* Cart */}
              <div>
                <p className="text-sm font-medium mb-2">Carrito</p>
                <div className="rounded-md border divide-y">
                  {cart.map((item, idx) => (
                    <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 px-3 py-2.5">
                      <Badge
                        variant={item.type === "service" ? "default" : "secondary"}
                        className="text-xs shrink-0"
                      >
                        {item.type === "service" ? "Servicio" : "Producto"}
                      </Badge>
                      <span className="flex-1 text-sm">{item.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.type === "product" && (
                          <button
                            onClick={() => updateQty(idx, -1)}
                            className="rounded p-0.5 hover:bg-accent text-muted-foreground"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        {item.type === "product" && (
                          <button
                            onClick={() => updateQty(idx, 1)}
                            className="rounded p-0.5 hover:bg-accent text-muted-foreground"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-24 h-7 text-sm text-right"
                        value={item.unit_price}
                        onChange={(e) => updatePrice(idx, e.target.value)}
                      />
                      <span className="w-20 text-right text-sm font-medium shrink-0">
                        {fmt(item.quantity * item.unit_price)}
                      </span>
                      {item.type === "product" ? (
                        <button
                          onClick={() => removeProduct(idx)}
                          className="rounded p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <div className="w-5" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-right text-sm font-semibold mt-2 pr-3">
                  Total: {fmt(cartTotal)}
                </div>
              </div>

              {/* Add products — buscador */}
              <div>
                <p className="text-sm font-medium mb-2">Agregar productos</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar por nombre, código o categoría..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
                <div className="rounded-md border divide-y max-h-48 overflow-y-auto mt-2">
                  {productsFetching ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground text-center">
                      Buscando...
                    </p>
                  ) : availableProducts.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground text-center">
                      {debouncedProductSearch
                        ? `Sin resultados para "${debouncedProductSearch}"`
                        : "No hay productos con stock"}
                    </p>
                  ) : (
                    availableProducts.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 cursor-pointer"
                        onClick={() => addProduct(p)}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {p.category_name && `${p.category_name} · `}
                            {p.sku && `${p.sku} · `}
                            Stock: {p.stock}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span className="text-sm text-muted-foreground">{fmt(p.price)}</span>
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sale notes */}
              <div className="space-y-1.5">
                <Label htmlFor="sale_notes">Notas de venta</Label>
                <Textarea
                  id="sale_notes"
                  rows={2}
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  placeholder="Observaciones opcionales..."
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive mt-4">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between items-center shrink-0">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={requestClose}>
                Cerrar
              </Button>
              <Button onClick={() => setStep(2)}>
                Siguiente: Carrito
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Volver
              </Button>
              <Button
                onClick={() => {
                  setError("")
                  finalizeMutation.mutate()
                }}
                disabled={finalizeMutation.isPending || cart.length === 0}
              >
                {finalizeMutation.isPending ? "Finalizando..." : "Cerrar atención · pasar a cobro"}
              </Button>
            </>
          )}
        </div>
      </div>

      <PatientQuickEditDialog
        open={editPatientOpen}
        onClose={() => setEditPatientOpen(false)}
        patientId={appointment.patient_id}
        patientName={appointment.patient_name}
      />
      <OwnerQuickEditDialog
        open={editOwnerOpen}
        onClose={() => setEditOwnerOpen(false)}
        ownerId={appointment.owner_id}
        ownerName={appointment.owner_name}
      />
      <ScheduleSurgeryDialog
        open={scheduleSurgeryOpen}
        onClose={() => setScheduleSurgeryOpen(false)}
        patientId={appointment.patient_id}
        patientName={appointment.patient_name}
        ownerId={appointment.owner_id}
      />

      {/* Aplicado en esta consulta — onSubmitDraft, no postea */}
      <VaccinationDialog
        open={appliedVaccDialogOpen}
        onClose={() => setAppliedVaccDialogOpen(false)}
        patientId={appointment.patient_id}
        patientName={appointment.patient_name}
        speciesId={patientForCatalog?.species_id ?? null}
        onSubmitDraft={(d) =>
          setAppliedVaccinations((prev) => [
            ...prev,
            { data: { ...d, photoFile: null }, photoFile: d.photoFile },
          ])
        }
      />
      <DewormingDialog
        open={appliedDewDialogOpen}
        onClose={() => setAppliedDewDialogOpen(false)}
        patientId={appointment.patient_id}
        patientName={appointment.patient_name}
        onSubmitDraft={(d) =>
          setAppliedDewormings((prev) => [
            ...prev,
            { data: { ...d, photoFile: null }, photoFile: d.photoFile },
          ])
        }
      />
      <SurgeryDialog
        open={appliedSurgDialogOpen}
        onClose={() => setAppliedSurgDialogOpen(false)}
        patientId={appointment.patient_id}
        patientName={appointment.patient_name}
        onSubmitDraft={(d) => setAppliedSurgeries((prev) => [...prev, { data: d }])}
      />

      {/* Antecedentes — postean inmediato al patient endpoint */}
      <VaccinationDialog
        open={historyVaccDialogOpen}
        onClose={() => setHistoryVaccDialogOpen(false)}
        patientId={appointment.patient_id}
        patientName={appointment.patient_name}
        speciesId={patientForCatalog?.species_id ?? null}
      />
      <DewormingDialog
        open={historyDewDialogOpen}
        onClose={() => setHistoryDewDialogOpen(false)}
        patientId={appointment.patient_id}
        patientName={appointment.patient_name}
      />
      <SurgeryDialog
        open={historySurgDialogOpen}
        onClose={() => setHistorySurgDialogOpen(false)}
        patientId={appointment.patient_id}
        patientName={appointment.patient_name}
      />
    </div>,
    document.body
  )
}
