import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Check, Minus, Plus, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useApiClient } from "@/api/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Appointment, AppointmentService, Product } from "@/types"

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
  serviceNotes: string
}

interface Draft {
  step: 1 | 2
  clinical: ClinicalState
  cart: CartItem[]
  saleNotes: string
}

const EMPTY_CLINICAL: ClinicalState = {
  reason: "",
  diagnosis: "",
  treatment: "",
  prescriptions: "",
  weight: "",
  temperature: "",
  serviceNotes: "",
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
  const showClinicalForm =
    appointment.service_type === "veterinary" || appointment.service_type === "promotional"
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
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Auto-save draft
  useEffect(() => {
    const draft: Draft = { step, clinical, cart, saleNotes }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [step, clinical, cart, saleNotes, DRAFT_KEY])

  // Queries
  const { data: services = [] } = useQuery({
    queryKey: ["appointment-services"],
    queryFn: () => api.get<AppointmentService[]>("/appointment-services"),
    staleTime: 60_000,
  })

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: () => api.get<Product[]>("/products?limit=200&is_active=true"),
    staleTime: 60_000,
    enabled: step === 2,
  })

  // Pre-load appointment service into cart (once services are loaded)
  useEffect(() => {
    if (services.length === 0) return
    if (cart.some((i) => i.type === "service")) return
    const svc = services.find((s) => s.id === appointment.service_id)
    if (!svc) return
    setCart((prev) => [
      {
        type: "service",
        id: svc.id,
        name: svc.name,
        quantity: 1,
        unit_price: svc.effective_price,
      },
      ...prev,
    ])
  }, [services, appointment.service_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close protection
  function hasContent() {
    if (hadDraft.current) return true
    if (showClinicalForm && clinical.reason.trim()) return true
    if (!showClinicalForm && clinical.serviceNotes.trim()) return true
    if (cart.some((i) => i.type === "product")) return true
    if (saleNotes.trim()) return true
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
      if (showClinicalForm && !clinical.reason.trim()) throw new Error("El motivo de consulta es obligatorio")
      if (cart.length === 0) throw new Error("El carrito no puede estar vacío")

      // 1. Medical record (veterinary + promotional)
      if (showClinicalForm) {
        await api.post("/medical-records", {
          patient_id: appointment.patient_id,
          appointment_id: appointment.id,
          reason: clinical.reason,
          diagnosis: clinical.diagnosis || null,
          treatment: clinical.treatment || null,
          prescriptions: clinical.prescriptions || null,
          weight: clinical.weight ? parseFloat(clinical.weight) : null,
          temperature: clinical.temperature ? parseFloat(clinical.temperature) : null,
        })
      }

      // 2. Sale
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
    },
    onError: (e: Error) => setError(e.message),
  })

  const availableProducts = products.filter(
    (p) => p.is_active && p.stock > 0 && !cart.some((i) => i.type === "product" && i.id === p.id)
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
              {appointment.service_name} · {appointment.owner_name}
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
            label={showClinicalForm ? "Historia clínica" : "Notas del servicio"}
            active={step === 1}
            done={step > 1}
          />
          <div className="h-px flex-1 bg-border" />
          <StepDot n={2} label="Carrito y finalizar" active={step === 2} done={false} />
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {step === 1 ? (
            <div className="space-y-4">
              {showClinicalForm ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="c_reason">Motivo de consulta *</Label>
                    <Textarea
                      id="c_reason"
                      rows={2}
                      value={clinical.reason}
                      onChange={(e) => setClinical({ ...clinical, reason: e.target.value })}
                      placeholder="Descripción del motivo de la visita"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c_diagnosis">Diagnóstico</Label>
                    <Textarea
                      id="c_diagnosis"
                      rows={2}
                      value={clinical.diagnosis}
                      onChange={(e) => setClinical({ ...clinical, diagnosis: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c_treatment">Tratamiento</Label>
                    <Textarea
                      id="c_treatment"
                      rows={2}
                      value={clinical.treatment}
                      onChange={(e) => setClinical({ ...clinical, treatment: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c_prescriptions">Prescripciones</Label>
                    <Textarea
                      id="c_prescriptions"
                      rows={2}
                      value={clinical.prescriptions}
                      onChange={(e) => setClinical({ ...clinical, prescriptions: e.target.value })}
                    />
                  </div>
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
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="c_service_notes">Notas del servicio</Label>
                  <Textarea
                    id="c_service_notes"
                    rows={5}
                    value={clinical.serviceNotes}
                    onChange={(e) => setClinical({ ...clinical, serviceNotes: e.target.value })}
                    placeholder="Observaciones del servicio de estética..."
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
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

              {/* Add products */}
              {availableProducts.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Agregar productos</p>
                  <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                    {availableProducts.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 cursor-pointer"
                        onClick={() => addProduct(p)}
                      >
                        <div>
                          <span className="text-sm">{p.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            Stock: {p.stock}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">{fmt(p.price)}</span>
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                {finalizeMutation.isPending ? "Finalizando..." : "Finalizar atención"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
