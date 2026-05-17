import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Camera, Copy, ImagePlus, Pencil, Plus, Trash2, UserPlus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useApiClient } from "@/api/client"
import { usePermissions } from "@/hooks/usePermissions"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import type { AppointmentService, Clinic, Role, ServiceType, User, UserArea } from "@/types"
import { SERVICE_TYPE_LABELS } from "@/types"

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
  const { showSuccess } = useToast()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ClinicForm>({
    name: "",
    phone: "",
    address: "",
    email: "",
    tax_id: "",
  })
  const [error, setError] = useState("")

  const logoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return api.upload<Clinic>("/configuration/logo", formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuration"] })
      showSuccess("Logo actualizado")
    },
    onError: (e: Error) => setError(e.message),
  })

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
      showSuccess("Datos de la clínica actualizados")
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
      ) : (
        <>
          {/* Logo */}
          <div className="flex items-center gap-4 pb-4 border-b">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) logoMutation.mutate(file)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoMutation.isPending}
              className="group relative h-20 w-20 rounded-lg border-2 border-dashed bg-muted overflow-hidden flex items-center justify-center hover:border-primary transition-colors disabled:opacity-60"
              title={clinic?.logo_url ? "Cambiar logo" : "Subir logo"}
            >
              {clinic?.logo_url ? (
                <>
                  <img src={clinic.logo_url} alt="Logo" className="h-full w-full object-contain" />
                  <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Camera className="h-5 w-5 text-white" />
                  </span>
                </>
              ) : (
                <span className="flex flex-col items-center text-muted-foreground text-[10px]">
                  <ImagePlus className="h-5 w-5 mb-0.5" />
                  {logoMutation.isPending ? "Subiendo..." : "Subir logo"}
                </span>
              )}
            </button>
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Logo de la clínica</p>
              <p>Aparece en el carnet sanitario y otros documentos imprimibles.</p>
              <p>PNG, JPEG o WebP.</p>
            </div>
          </div>

          {editing ? (
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
        </>
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

function ServicesSection() {
  const api = useApiClient()
  const queryClient = useQueryClient()
  const { showSuccess } = useToast()
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
      showSuccess("Servicio creado")
    },
    onError: (e: Error) => setError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api.patch<AppointmentService>(`/appointment-services/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-services"] })
      closeForm()
      showSuccess("Servicio actualizado")
    },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/appointment-services/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-services"] })
      setDeleteTarget(null)
      showSuccess("Servicio eliminado")
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

// ── Sección de usuarios, roles y áreas ──────────────────────────────────────

const AREA_OPTIONS: ServiceType[] = ["veterinary", "grooming", "aesthetic"]

interface NewUserForm {
  full_name: string
  email: string
  role_id: string
  areas: UserArea[]
}

const EMPTY_NEW_USER: NewUserForm = {
  full_name: "", email: "", role_id: "", areas: [],
}

function UsersSection() {
  const api = useApiClient()
  const qc = useQueryClient()
  const { showSuccess } = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAreas, setEditAreas] = useState<UserArea[]>([])
  const [editRoleId, setEditRoleId] = useState("")
  const [error, setError] = useState("")
  // Nuevo usuario
  const [newOpen, setNewOpen] = useState(false)
  const [newForm, setNewForm] = useState<NewUserForm>(EMPTY_NEW_USER)
  const [newError, setNewError] = useState("")
  // Password temp post-creación
  const [createdResult, setCreatedResult] = useState<{
    user: User
    temporary_password: string
  } | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
    staleTime: 30_000,
  })

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get<Role[]>("/roles"),
    staleTime: Infinity,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api.patch<User>(`/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] })
      setEditingId(null)
      setError("")
      showSuccess("Usuario actualizado")
    },
    onError: (e: Error) => setError(e.message),
  })

  const createMutation = useMutation({
    mutationFn: (data: object) =>
      api.post<{ user: User; temporary_password: string }>("/users", data),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ["users"] })
      setNewOpen(false)
      setNewForm(EMPTY_NEW_USER)
      setNewError("")
      setCreatedResult(resp)
    },
    onError: (e: Error) => setNewError(e.message),
  })

  function startEdit(u: User) {
    setEditingId(u.id)
    setEditAreas([...u.areas])
    setEditRoleId(u.role_id)
    setError("")
  }

  function cancelEdit() {
    setEditingId(null)
    setEditAreas([])
    setEditRoleId("")
    setError("")
  }

  function toggleArea(area: UserArea, target: "edit" | "new") {
    if (target === "edit") {
      setEditAreas((prev) =>
        prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
      )
    } else {
      setNewForm((prev) => ({
        ...prev,
        areas: prev.areas.includes(area)
          ? prev.areas.filter((a) => a !== area)
          : [...prev.areas, area],
      }))
    }
  }

  function saveEdit() {
    if (!editingId) return
    updateMutation.mutate({
      id: editingId,
      data: { areas: editAreas, role_id: editRoleId },
    })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setNewError("")
    if (!newForm.full_name.trim()) { setNewError("Nombre requerido"); return }
    if (!newForm.email.trim()) { setNewError("Email requerido"); return }
    if (!newForm.role_id) { setNewError("Seleccioná un rol"); return }
    createMutation.mutate({
      full_name: newForm.full_name,
      email: newForm.email,
      role_id: newForm.role_id,
      areas: newForm.areas,
    })
  }

  async function copyPassword() {
    if (!createdResult) return
    try {
      await navigator.clipboard.writeText(createdResult.temporary_password)
    } catch {
      // Si falla el clipboard, no pasa nada — el usuario ve la password en pantalla
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Usuarios, roles y áreas</h2>
          <p className="text-sm text-muted-foreground">
            Asigná rol y áreas a cada profesional. Sin áreas, el usuario puede asignarse a citas
            de cualquier área.
          </p>
        </div>
        <Button size="sm" onClick={() => { setNewForm(EMPTY_NEW_USER); setNewOpen(true); setNewError("") }}>
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nombre</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Rol</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Áreas</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isEditing = editingId === u.id
                return (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{u.full_name}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{u.email}</td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <Select
                          value={editRoleId}
                          onChange={(e) => setEditRoleId(e.target.value)}
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </Select>
                      ) : (
                        <span className="text-muted-foreground capitalize">{u.role_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <div className="flex flex-wrap gap-2">
                          {AREA_OPTIONS.map((area) => (
                            <label
                              key={area}
                              className="flex items-center gap-1.5 text-xs cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={editAreas.includes(area)}
                                onChange={() => toggleArea(area, "edit")}
                              />
                              {SERVICE_TYPE_LABELS[area]}
                            </label>
                          ))}
                        </div>
                      ) : u.areas.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">Todas</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.areas.map((a) => (
                            <Badge key={a} variant="secondary" className="text-xs">
                              {SERVICE_TYPE_LABELS[a]}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                            disabled={updateMutation.isPending}
                          >
                            Cancelar
                          </Button>
                          <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? "Guardando..." : "Guardar"}
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(u)}
                          className="rounded p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Editar rol y áreas"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Dialog: Nuevo usuario */}
      <Dialog open={newOpen} onClose={() => setNewOpen(false)} title="Nuevo usuario" className="max-w-md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nu_name">Nombre completo *</Label>
            <Input
              id="nu_name"
              required
              value={newForm.full_name}
              onChange={(e) => setNewForm({ ...newForm, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nu_email">Email *</Label>
            <Input
              id="nu_email"
              type="email"
              required
              value={newForm.email}
              onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nu_role">Rol *</Label>
            <Select
              id="nu_role"
              required
              value={newForm.role_id}
              onChange={(e) => setNewForm({ ...newForm, role_id: e.target.value })}
            >
              <option value="">Seleccionar rol...</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id} className="capitalize">{r.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Áreas (opcional)</Label>
            <div className="flex flex-wrap gap-3">
              {AREA_OPTIONS.map((area) => (
                <label key={area} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newForm.areas.includes(area)}
                    onChange={() => toggleArea(area, "new")}
                  />
                  {SERVICE_TYPE_LABELS[area]}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Sin áreas marcadas, el usuario puede atender en cualquier área.
            </p>
          </div>
          {newError && <p className="text-sm text-destructive">{newError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creando..." : "Crear usuario"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dialog: password temporal post-creación */}
      <Dialog
        open={createdResult !== null}
        onClose={() => setCreatedResult(null)}
        title="Usuario creado"
        className="max-w-md"
      >
        {createdResult && (
          <div className="space-y-4">
            <p className="text-sm">
              <span className="font-semibold">{createdResult.user.full_name}</span> ya tiene cuenta
              en Clerk con email <code className="text-xs">{createdResult.user.email}</code>.
            </p>
            <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 space-y-2">
              <p className="text-xs text-amber-800 font-medium">
                Compartí esta contraseña temporal con la persona. Solo se muestra una vez:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-white rounded border text-sm font-mono break-all">
                  {createdResult.temporary_password}
                </code>
                <Button type="button" size="sm" variant="outline" onClick={copyPassword}>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-amber-800">
                Indicá al usuario que ingrese en la app y cambie su contraseña desde su perfil.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setCreatedResult(null)}>Listo</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

// ── Sección de roles y permisos ──────────────────────────────────────────────

interface PermissionCatalogItem {
  action: string
}

interface RolePermissionsRead {
  role_id: string
  role_name: string
  permissions: string[]
}

// Etiquetas legibles para cada permiso del catálogo
const PERMISSION_LABELS: Record<string, string> = {
  "configuration.view": "Ver configuración",
  "configuration.edit": "Editar configuración",
  "users.view": "Ver usuarios",
  "users.create": "Crear usuarios",
  "users.edit": "Editar usuarios",
  "users.deactivate": "Desactivar usuarios",
  "roles.view": "Ver roles y permisos",
  "roles.edit_permissions": "Editar permisos por rol",
  "owners.view": "Ver propietarios",
  "owners.create": "Crear propietarios",
  "owners.edit": "Editar propietarios",
  "patients.view": "Ver mascotas",
  "patients.create": "Crear mascotas",
  "patients.edit": "Editar mascotas",
  "appointments.view_all": "Ver todas las citas",
  "appointments.view_own": "Ver solo sus citas",
  "appointments.create": "Crear citas",
  "appointments.edit": "Editar citas",
  "appointments.cancel": "Cancelar citas",
  "medical_records.view": "Ver historia clínica",
  "medical_records.create": "Crear historia clínica",
  "medical_records.edit": "Editar historia clínica",
  "products.view": "Ver inventario",
  "products.manage": "Gestionar productos",
  "products.stock_in": "Cargar stock",
  "sales.view": "Ver ventas",
  "sales.create": "Crear ventas",
  "sales.cancel": "Cancelar ventas",
  "reports.view_general": "Ver reportes generales",
  "reports.view_own": "Ver sus propios reportes",
}

const MODULE_LABELS: Record<string, string> = {
  configuration: "Configuración",
  users: "Usuarios",
  roles: "Roles y permisos",
  owners: "Propietarios",
  patients: "Mascotas",
  appointments: "Citas",
  medical_records: "Historia clínica",
  products: "Inventario",
  sales: "Ventas",
  reports: "Reportes",
}

function groupByModule(actions: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}
  for (const action of actions) {
    const mod = action.split(".")[0]
    if (!grouped[mod]) grouped[mod] = []
    grouped[mod].push(action)
  }
  return grouped
}

function RolesSection() {
  const api = useApiClient()
  const queryClient = useQueryClient()
  const { showSuccess } = useToast()
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Set<string>>>({})
  const [error, setError] = useState("")
  const [savedRoleId, setSavedRoleId] = useState<string | null>(null)

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get<Role[]>("/roles"),
  })

  const { data: catalog = [] } = useQuery({
    queryKey: ["permissions-catalog"],
    queryFn: () => api.get<PermissionCatalogItem[]>("/roles/permissions/catalog"),
  })

  const { data: rolePerms } = useQuery({
    queryKey: ["role-permissions", expandedRoleId],
    queryFn: () => api.get<RolePermissionsRead>(`/roles/${expandedRoleId}/permissions`),
    enabled: !!expandedRoleId,
  })

  // Cuando llega rolePerms, inicializa el draft del rol expandido
  useEffect(() => {
    if (rolePerms && !drafts[rolePerms.role_id]) {
      setDrafts((d) => ({ ...d, [rolePerms.role_id]: new Set(rolePerms.permissions) }))
    }
  }, [rolePerms, drafts])

  const updateMutation = useMutation({
    mutationFn: ({ roleId, permissions }: { roleId: string; permissions: string[] }) =>
      api.put<RolePermissionsRead>(`/roles/${roleId}/permissions`, { permissions }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions", data.role_id] })
      queryClient.invalidateQueries({ queryKey: ["auth-me"] })
      setSavedRoleId(data.role_id)
      setError("")
      setTimeout(() => setSavedRoleId(null), 2000)
      showSuccess(`Permisos del rol ${data.role_name} actualizados`)
    },
    onError: (e: Error) => setError(e.message),
  })

  function togglePermission(roleId: string, action: string) {
    setDrafts((d) => {
      const current = new Set(d[roleId] ?? [])
      if (current.has(action)) current.delete(action)
      else current.add(action)
      return { ...d, [roleId]: current }
    })
  }

  function save(roleId: string) {
    const draft = drafts[roleId]
    if (!draft) return
    updateMutation.mutate({ roleId, permissions: Array.from(draft) })
  }

  function resetDraft(roleId: string) {
    setDrafts((d) => {
      const next = { ...d }
      delete next[roleId]
      return next
    })
  }

  const grouped = groupByModule(catalog.map((c) => c.action))
  const moduleOrder = Object.keys(MODULE_LABELS).filter((m) => grouped[m])

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Roles y permisos</h2>
        <p className="text-sm text-muted-foreground">
          Define qué puede hacer cada rol dentro de la clínica.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {roles.map((role) => {
          const isExpanded = expandedRoleId === role.id
          const isAdmin = role.name === "admin"
          const draft = drafts[role.id]
          const dirty =
            !!rolePerms &&
            rolePerms.role_id === role.id &&
            draft !== undefined &&
            (draft.size !== rolePerms.permissions.length ||
              !rolePerms.permissions.every((p) => draft.has(p)))

          return (
            <div key={role.id} className="rounded-md border">
              <button
                type="button"
                onClick={() => {
                  setExpandedRoleId(isExpanded ? null : role.id)
                  if (isExpanded) resetDraft(role.id)
                }}
                className="flex w-full items-center justify-between px-4 py-3 hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium capitalize">{role.name}</span>
                  {isAdmin && (
                    <Badge variant="default">Acceso total</Badge>
                  )}
                  {savedRoleId === role.id && (
                    <Badge variant="success">Guardado</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {isExpanded ? "Ocultar" : "Editar"}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t px-4 py-4 space-y-4">
                  {isAdmin ? (
                    <p className="text-sm text-muted-foreground">
                      El rol administrador tiene siempre todos los permisos y no puede modificarse.
                    </p>
                  ) : !rolePerms || rolePerms.role_id !== role.id ? (
                    <p className="text-sm text-muted-foreground">Cargando permisos...</p>
                  ) : (
                    <>
                      {moduleOrder.map((mod) => (
                        <div key={mod}>
                          <h3 className="text-sm font-semibold mb-2">
                            {MODULE_LABELS[mod]}
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {grouped[mod].map((action) => (
                              <label
                                key={action}
                                className="flex items-center gap-2 text-sm cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={draft?.has(action) ?? false}
                                  onChange={() => togglePermission(role.id, action)}
                                  className="h-4 w-4 rounded border-input"
                                />
                                <span>{PERMISSION_LABELS[action] ?? action}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => resetDraft(role.id)}
                          disabled={!dirty || updateMutation.isPending}
                        >
                          Descartar cambios
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => save(role.id)}
                          disabled={!dirty || updateMutation.isPending}
                        >
                          {updateMutation.isPending ? "Guardando..." : "Guardar"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────

export function ConfigurationPage() {
  const { can } = usePermissions()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">Ajustes generales de la clínica</p>
      </div>
      <ClinicSection />
      {can("users.view") && <UsersSection />}
      {can("roles.view") && <RolesSection />}
      <ServicesSection />
    </div>
  )
}
