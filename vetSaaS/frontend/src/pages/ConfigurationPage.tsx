import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useApiClient } from "@/api/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import type { AppointmentService, Clinic } from "@/types"

// ── Sección datos de la clínica ─────────────────────────────────────────────

interface ClinicForm {
  name: string
  phone: string
  address: string
  email: string
  tax_id: string
}

function ClinicSection() {
  const api = useApiClient()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ClinicForm>({
    name: "",
    phone: "",
    address: "",
    email: "",
    tax_id: "",
  })
  const [error, setError] = useState("")

  const { data: clinic, isLoading } = useQuery({
    queryKey: ["configuration"],
    queryFn: () => api.get<Clinic>("/configuration"),
  })

  useEffect(() => {
    if (clinic) {
      setForm({
        name: clinic.name,
        phone: clinic.phone ?? "",
        address: clinic.address ?? "",
        email: clinic.email ?? "",
        tax_id: clinic.tax_id ?? "",
      })
    }
  }, [clinic])

  const updateMutation = useMutation({
    mutationFn: (data: object) => api.patch<Clinic>("/configuration", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuration"] })
      setEditing(false)
      setError("")
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    updateMutation.mutate({
      name: form.name,
      phone: form.phone || null,
      address: form.address || null,
      email: form.email || null,
      tax_id: form.tax_id || null,
    })
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Datos de la clínica</h2>
        {!editing && !isLoading && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : editing ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="clinic_name">Nombre *</Label>
              <Input
                id="clinic_name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clinic_phone">Teléfono</Label>
              <Input
                id="clinic_phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clinic_email">Email</Label>
              <Input
                id="clinic_email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="clinic_address">Dirección</Label>
              <Input
                id="clinic_address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clinic_tax_id">RUC / NIT / RFC</Label>
              <Input
                id="clinic_tax_id"
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(false)
                setError("")
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
          <div>
            <p className="text-muted-foreground">Nombre</p>
            <p className="font-medium mt-0.5">{clinic?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Teléfono</p>
            <p className="font-medium mt-0.5">{clinic?.phone ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium mt-0.5">{clinic?.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">RUC / NIT / RFC</p>
            <p className="font-medium mt-0.5">{clinic?.tax_id ?? "—"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-muted-foreground">Dirección</p>
            <p className="font-medium mt-0.5">{clinic?.address ?? "—"}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sección servicios de cita ────────────────────────────────────────────────

interface ServiceForm {
  name: string
  service_type: "veterinary" | "grooming" | "promotional" | ""
  duration_minutes: string
  price: string
  promo_price: string
  promo_start: string
  promo_end: string
}

const EMPTY_SERVICE: ServiceForm = {
  name: "", service_type: "", duration_minutes: "30", price: "0",
  promo_price: "", promo_start: "", promo_end: "",
}

const SERVICE_TYPE_LABELS: Record<"veterinary" | "grooming" | "promotional", string> = {
  veterinary: "Veterinaria",
  grooming: "Estética",
  promotional: "Promoción",
}

function ServicesSection() {
  const api = useApiClient()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AppointmentService | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AppointmentService | null>(null)
  const [form, setForm] = useState<ServiceForm>(EMPTY_SERVICE)
  const [error, setError] = useState("")

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["appointment-services"],
    queryFn: () => api.get<AppointmentService[]>("/appointment-services"),
  })

  const createMutation = useMutation({
    mutationFn: (data: object) =>
      api.post<AppointmentService>("/appointment-services", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-services"] })
      closeForm()
    },
    onError: (e: Error) => setError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api.patch<AppointmentService>(`/appointment-services/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-services"] })
      closeForm()
    },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/appointment-services/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-services"] })
      setDeleteTarget(null)
    },
    onError: (e: Error) => setError(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_SERVICE)
    setError("")
    setFormOpen(true)
  }

  function openEdit(s: AppointmentService) {
    setEditing(s)
    setForm({
      name: s.name,
      service_type: s.service_type,
      duration_minutes: s.duration_minutes.toString(),
      price: s.price.toString(),
      promo_price: s.promo_price?.toString() ?? "",
      promo_start: s.promo_start ?? "",
      promo_end: s.promo_end ?? "",
    })
    setError("")
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setForm(EMPTY_SERVICE)
    setError("")
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const payload = {
      name: form.name,
      service_type: form.service_type,
      duration_minutes: parseInt(form.duration_minutes, 10),
      price: parseFloat(form.price) || 0,
      promo_price: form.promo_price ? parseFloat(form.promo_price) : null,
      promo_start: form.promo_start || null,
      promo_end: form.promo_end || null,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Servicios de cita</h2>
          <p className="text-sm text-muted-foreground">
            Tipos de servicio disponibles para agendar citas
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo servicio
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No hay servicios configurados. Agrega uno para poder crear citas.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="text-left py-2 font-medium text-muted-foreground">Nombre</th>
              <th className="text-left py-2 font-medium text-muted-foreground">Tipo</th>
              <th className="text-left py-2 font-medium text-muted-foreground">Duración</th>
              <th className="text-right py-2 font-medium text-muted-foreground">Precio</th>
              <th className="text-right py-2 font-medium text-muted-foreground">Promoción</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => {
              const today = new Date().toISOString().slice(0, 10)
              const promoActive =
                s.promo_price != null &&
                s.promo_start != null && s.promo_end != null &&
                s.promo_start <= today && s.promo_end >= today
              return (
              <tr
                key={s.id}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="py-3 font-medium">{s.name}</td>
                <td className="py-3">
                  <Badge variant={s.service_type === "veterinary" ? "default" : s.service_type === "promotional" ? "warning" : "secondary"}>
                    {SERVICE_TYPE_LABELS[s.service_type]}
                  </Badge>
                </td>
                <td className="py-3 text-muted-foreground">{s.duration_minutes} min</td>
                <td className="py-3 text-right font-medium">
                  {new Intl.NumberFormat("es", { style: "currency", currency: "USD" }).format(s.price)}
                </td>
                <td className="py-3 text-right">
                  {s.promo_price != null ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <span className={`text-xs font-medium ${promoActive ? "text-green-600" : "text-muted-foreground"}`}>
                        {new Intl.NumberFormat("es", { style: "currency", currency: "USD" }).format(s.promo_price)}
                      </span>
                      {promoActive && (
                        <Badge variant="success" className="text-xs">PROMO</Badge>
                      )}
                      {!promoActive && s.promo_start && s.promo_end && (
                        <span className="text-xs text-muted-foreground">
                          {s.promo_start} → {s.promo_end}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(s)}
                      className="rounded p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setError(""); setDeleteTarget(s) }}
                      className="rounded p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      )}

      {/* Crear / Editar */}
      <Dialog
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Editar servicio" : "Nuevo servicio"}
        className="max-w-sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="svc_name">Nombre *</Label>
            <Input
              id="svc_name"
              required
              placeholder="ej. Consulta general, Baño y corte"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc_type">Tipo *</Label>
            <Select
              id="svc_type"
              required
              value={form.service_type}
              onChange={(e) =>
                setForm({ ...form, service_type: e.target.value as "veterinary" | "grooming" })
              }
            >
              <option value="">Seleccionar tipo...</option>
              <option value="veterinary">Veterinaria</option>
              <option value="grooming">Estética</option>
              <option value="promotional">Promoción (incluye vet + estética)</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc_duration">Duración (minutos) *</Label>
            <Input
              id="svc_duration"
              type="number"
              required
              min="5"
              step="5"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc_price">Precio (USD)</Label>
            <Input
              id="svc_price"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <div className="border-t pt-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Promoción temporal (opcional)</p>
            <div className="space-y-1.5">
              <Label htmlFor="svc_promo_price">Precio promocional (USD)</Label>
              <Input
                id="svc_promo_price"
                type="number"
                min="0"
                step="0.01"
                value={form.promo_price}
                onChange={(e) => setForm({ ...form, promo_price: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="svc_promo_start">Desde</Label>
                <Input
                  id="svc_promo_start"
                  type="date"
                  value={form.promo_start}
                  onChange={(e) => setForm({ ...form, promo_start: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc_promo_end">Hasta</Label>
                <Input
                  id="svc_promo_end"
                  type="date"
                  value={form.promo_end}
                  onChange={(e) => setForm({ ...form, promo_end: e.target.value })}
                />
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : editing ? "Guardar cambios" : "Crear servicio"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar servicio"
        className="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Eliminar el servicio{" "}
            <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────

export function ConfigurationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">Ajustes generales de la clínica</p>
      </div>
      <ClinicSection />
      <ServicesSection />
    </div>
  )
}
