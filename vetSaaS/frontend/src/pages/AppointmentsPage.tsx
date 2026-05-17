import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, List, Pencil, PlayCircle, Plus, User as UserIcon, PawPrint, Stethoscope, X, XCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useApiClient } from "@/api/client"
import { usePermissions } from "@/hooks/usePermissions"
import { useToast } from "@/components/ui/toast"
import { AppointmentCalendar, getWeekStart, addDays } from "@/components/AppointmentCalendar"
import { AssigneeCombobox } from "@/components/AssigneeCombobox"
import { ConsultationModal } from "@/components/ConsultationModal"
import { DayTimeline } from "@/components/DayTimeline"
import { OwnerCombobox } from "@/components/OwnerCombobox"
import { PatientCombobox } from "@/components/PatientCombobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type {
  Appointment,
  AppointmentService,
  AppointmentStatus,
  Owner,
  Patient,
  ServiceType,
  User,
} from "@/types"
import { SERVICE_TYPE_LABELS } from "@/types"

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  attended: "Atendida",
  cancelled: "Cancelada",
}

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "secondary" | "outline"

const STATUS_VARIANT: Record<AppointmentStatus, BadgeVariant> = {
  pending: "warning",
  confirmed: "default",
  attended: "success",
  cancelled: "destructive",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// scheduled_at viaja en UTC porque la columna es TIMESTAMPTZ.
function toUTCISO(date: Date) {
  return date.toISOString()
}

// ── Form types ────────────────────────────────────────────────────────────────

interface ApptForm {
  area: ServiceType | ""        // se selecciona primero; filtra servicios y profesionales
  service_ids: string[]         // multi: todos del mismo área
  date: string                  // YYYY-MM-DD
  time: string                  // HH:MM
  status: AppointmentStatus | ""
  notes: string
}

const EMPTY: ApptForm = {
  area: "",
  service_ids: [],
  date: "",
  time: "",
  status: "",
  notes: "",
}

function computeEndTime(timeStr: string, durationMin: number): string {
  if (!timeStr || !durationMin) return ""
  const [h, m] = timeStr.split(":").map(Number)
  const total = h * 60 + m + durationMin
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

function shiftDate(yyyymmdd: string, days: number): string {
  if (!yyyymmdd) return ""
  const d = new Date(yyyymmdd + "T00:00:00")
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString("en-CA")
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AppointmentsPage() {
  const api = useApiClient()
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const { showSuccess } = useToast()

  const [viewMode, setViewMode] = useState<"table" | "calendar">("table")
  const [calWeekStart, setCalWeekStart] = useState(() => getWeekStart(new Date()))
  const [statusFilter, setStatusFilter] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedAssignee, setSelectedAssignee] = useState<User | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  const [form, setForm] = useState<ApptForm>(EMPTY)
  const [error, setError] = useState("")
  const [consultationAppt, setConsultationAppt] = useState<Appointment | null>(null)
  // For "agendar otro servicio" prompt after creation
  const [justCreated, setJustCreated] = useState<{ patientName: string } | null>(null)

  // Table query
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", statusFilter],
    queryFn: () =>
      api.get<Appointment[]>(
        `/appointments?limit=100${statusFilter ? `&status=${statusFilter}` : ""}`
      ),
    staleTime: 0,
  })

  // Calendar query — only active when calendar view is open
  const calWeekEnd = addDays(calWeekStart, 6)
  calWeekEnd.setHours(23, 59, 59, 0)
  const { data: calAppts = [], isLoading: calLoading } = useQuery({
    queryKey: ["appointments-calendar", calWeekStart.toISOString().slice(0, 10)],
    queryFn: () =>
      api.get<Appointment[]>(
        `/appointments?date_from=${encodeURIComponent(toUTCISO(calWeekStart))}&date_to=${encodeURIComponent(toUTCISO(calWeekEnd))}&limit=200`
      ),
    enabled: viewMode === "calendar",
    staleTime: 0,
  })

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
    enabled: formOpen,
    staleTime: 60_000,
  })

  const { data: services = [] } = useQuery({
    queryKey: ["appointment-services"],
    queryFn: () => api.get<AppointmentService[]>("/appointment-services"),
    enabled: formOpen,
  })

  // Citas del día seleccionado en el form (para el timeline)
  const formDate = (() => {
    if (form.date) return form.date
    if (editing) return new Date(editing.scheduled_at).toLocaleDateString("en-CA")
    return ""
  })()

  const { data: dayAppts = [] } = useQuery({
    queryKey: ["appointments-day", formDate],
    queryFn: () =>
      api.get<Appointment[]>(
        `/appointments?date_from=${encodeURIComponent(new Date(`${formDate}T00:00:00`).toISOString())}&date_to=${encodeURIComponent(new Date(`${formDate}T23:59:59`).toISOString())}&limit=200`
      ),
    enabled: formOpen && !!formDate,
    staleTime: 30_000,
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["appointments"] })
    queryClient.invalidateQueries({ queryKey: ["appointments-today"] })
    queryClient.invalidateQueries({ queryKey: ["appointments-upcoming"] })
    queryClient.invalidateQueries({ queryKey: ["appointments-calendar"] })
    queryClient.invalidateQueries({ queryKey: ["appointments-day"] })
  }

  const selectedServices = useMemo(
    () => services.filter((s) => form.service_ids.includes(s.id)),
    [services, form.service_ids]
  )
  const duration = selectedServices.reduce((acc, s) => acc + s.duration_minutes, 0)
  const endTime = computeEndTime(form.time, duration)
  const newStartISO = form.date && form.time ? `${form.date}T${form.time}:00` : null

  // Servicios disponibles según el área seleccionada
  const servicesInArea = useMemo(
    () => (form.area ? services.filter((s) => s.service_type === form.area) : []),
    [services, form.area]
  )

  // Profesionales del área seleccionada (areas vacío = sin restricción → puede cualquiera)
  const usersInArea = useMemo(
    () => (form.area ? users.filter((u) => u.areas.length === 0 || u.areas.includes(form.area as ServiceType)) : users),
    [users, form.area]
  )

  function toggleService(serviceId: string) {
    setForm((f) => {
      const has = f.service_ids.includes(serviceId)
      return {
        ...f,
        service_ids: has ? f.service_ids.filter((id) => id !== serviceId) : [...f.service_ids, serviceId],
      }
    })
  }

  function handleAreaChange(area: ServiceType | "") {
    setForm((f) => ({ ...f, area, service_ids: [] }))
    // Si el profesional seleccionado no trabaja en esa área, lo limpiamos
    if (selectedAssignee && area && selectedAssignee.areas.length > 0 && !selectedAssignee.areas.includes(area)) {
      setSelectedAssignee(null)
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post<Appointment>("/appointments", data),
    onSuccess: () => {
      invalidateAll()
      setJustCreated({ patientName: selectedPatient?.name ?? "la mascota" })
      // Keep owner+patient+date+area for quick second booking; reset services/time/assignee/notes
      setForm((f) => ({ ...f, service_ids: [], time: "", notes: "", status: "" }))
      setSelectedAssignee(null)
      setShowNotes(false)
      setError("")
      showSuccess("Cita creada")
    },
    onError: (e: Error) => setError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api.patch<Appointment>(`/appointments/${id}`, data),
    onSuccess: () => {
      invalidateAll()
      closeForm()
      showSuccess("Cita actualizada")
    },
    onError: (e: Error) => setError(e.message),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.del(`/appointments/${id}`),
    onSuccess: () => {
      invalidateAll()
      setCancelTarget(null)
      showSuccess("Cita cancelada")
    },
    onError: (e: Error) => setError(e.message),
  })

  function openCreate(preset?: { date?: string; area?: ServiceType }) {
    setEditing(null)
    setSelectedOwner(null)
    setSelectedPatient(null)
    setSelectedAssignee(null)
    setShowNotes(false)
    setForm({
      ...EMPTY,
      date: preset?.date ?? new Date().toLocaleDateString("en-CA"),
      area: preset?.area ?? "",
    })
    setError("")
    setJustCreated(null)
    setFormOpen(true)
  }

  // Pre-fill desde query params: /appointments?new=1&patient_id=...&owner_id=...&area=...&date=...
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get("new") !== "1") return

    const patientId = searchParams.get("patient_id")
    const ownerId = searchParams.get("owner_id")
    const area = searchParams.get("area") as ServiceType | null
    const date = searchParams.get("date") || undefined

    openCreate({
      date,
      area: area && ["veterinary", "grooming", "aesthetic"].includes(area) ? area : undefined,
    })

    // Resolver el paciente y propietario por API si vinieron sus IDs
    if (patientId) {
      api.get<Patient>(`/patients/${patientId}`).then((p) => setSelectedPatient(p))
    }
    if (ownerId) {
      api.get<Owner>(`/owners/${ownerId}`).then((o) => setSelectedOwner(o))
    }

    // Limpiar query params para no reabrir si recargan
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openEdit(appt: Appointment) {
    setEditing(appt)
    setSelectedOwner(null) // edit no usa combobox
    setSelectedPatient(null)
    setSelectedAssignee(null)
    setShowNotes(!!appt.notes)
    setJustCreated(null)
    const d = new Date(appt.scheduled_at)
    setForm({
      area: appt.service_type,
      service_ids: appt.services.map((s) => s.id),
      date: d.toLocaleDateString("en-CA"),
      time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      status: appt.status,
      notes: appt.notes ?? "",
    })
    setError("")
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setSelectedOwner(null)
    setSelectedPatient(null)
    setSelectedAssignee(null)
    setShowNotes(false)
    setForm(EMPTY)
    setError("")
    setJustCreated(null)
  }

  function handleOwnerChange(owner: Owner | null) {
    setSelectedOwner(owner)
    // si cambia el owner, el patient previamente seleccionado puede no ser de ese owner
    setSelectedPatient(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.area) { setError("Selecciona un área"); return }
    if (form.service_ids.length === 0) { setError("Selecciona al menos un servicio"); return }
    if (!form.date || !form.time) { setError("Selecciona fecha y hora"); return }

    const scheduledDate = new Date(`${form.date}T${form.time}:00`)
    // Validación: no permitir fecha/hora pasada (tolerancia 1 min)
    if (scheduledDate.getTime() < Date.now() - 60_000) {
      setError("La cita no puede tener fecha y hora anterior a la actual")
      return
    }
    const scheduledAt = scheduledDate.toISOString()

    if (editing) {
      if (!selectedAssignee && !editing.assigned_user_id) {
        setError("Selecciona un profesional")
        return
      }
      updateMutation.mutate({
        id: editing.id,
        data: {
          assigned_user_id: selectedAssignee?.id ?? editing.assigned_user_id,
          service_ids: form.service_ids,
          scheduled_at: scheduledAt,
          status: form.status || undefined,
          notes: form.notes || null,
        },
      })
    } else {
      if (!selectedOwner) { setError("Selecciona un propietario"); return }
      if (!selectedPatient) { setError("Selecciona una mascota"); return }
      if (!selectedAssignee) { setError("Selecciona un profesional"); return }
      createMutation.mutate({
        patient_id: selectedPatient.id,
        owner_id: selectedOwner.id,
        assigned_user_id: selectedAssignee.id,
        service_ids: form.service_ids,
        scheduled_at: scheduledAt,
        notes: form.notes || null,
      })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Citas</h1>
          <p className="text-sm text-muted-foreground">Gestión de citas veterinarias</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
                viewMode === "table"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
                viewMode === "calendar"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Semana
            </button>
          </div>
          {can("appointments.create") && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nueva cita
            </Button>
          )}
        </div>
      </div>

      {/* Filters — only in table mode */}
      {viewMode === "table" && (
        <Select
          className="w-48"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="confirmed">Confirmada</option>
          <option value="attended">Atendida</option>
          <option value="cancelled">Cancelada</option>
        </Select>
      )}

      {/* Calendar view */}
      {viewMode === "calendar" && (
        <AppointmentCalendar
          appointments={calAppts}
          isLoading={calLoading}
          weekStart={calWeekStart}
          onPrevWeek={() => setCalWeekStart((d) => addDays(d, -7))}
          onNextWeek={() => setCalWeekStart((d) => addDays(d, 7))}
          onStartConsultation={setConsultationAppt}
          onEdit={openEdit}
          onCancel={(appt) => { setError(""); setCancelTarget(appt) }}
        />
      )}

      {/* Table view */}
      {viewMode === "table" && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mascota</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Propietario</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Servicio</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha y hora</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Asignado a</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Cargando...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No hay citas registradas
                  </td>
                </tr>
              ) : (
                appointments.map((appt) => (
                  <tr
                    key={appt.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      {appt.is_emergency && (
                        <span className="inline-flex items-center gap-1 mr-2 text-xs px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-semibold">
                          🚨 Emergencia
                        </span>
                      )}
                      {appt.patient_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{appt.owner_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {appt.services.map((s) => s.name).join(" + ")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(appt.scheduled_at).toLocaleString("es", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[appt.status]}>
                        {STATUS_LABELS[appt.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{appt.assigned_user_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {(appt.status === "pending" || appt.status === "confirmed") && (
                          <button
                            onClick={() => setConsultationAppt(appt)}
                            className="rounded p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Iniciar atención"
                          >
                            <PlayCircle className="h-4 w-4" />
                          </button>
                        )}
                        {appt.status !== "cancelled" && appt.status !== "attended" && (
                          <button
                            onClick={() => openEdit(appt)}
                            className="rounded p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {appt.status !== "cancelled" && (
                          <button
                            onClick={() => { setError(""); setCancelTarget(appt) }}
                            className="rounded p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Cancelar cita"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Crear / Editar */}
      <Dialog
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Editar cita" : "Nueva cita"}
        className={editing ? "max-w-lg" : "max-w-5xl"}
      >
        {/* Banner cuando se acaba de crear */}
        {justCreated && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-green-800 font-medium">
              ✓ Cita creada para {justCreated.patientName}
            </p>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setJustCreated(null)}>
                Agregar otro servicio
              </Button>
              <Button size="sm" onClick={closeForm}>
                Cerrar
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {editing ? (
            // ── EDIT MODE: form simple (no se puede cambiar mascota/owner) ─────
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Mascota: </span>
                <span className="font-medium">{editing.patient_name}</span>
                <span className="text-muted-foreground ml-3">Propietario: </span>
                <span className="font-medium">{editing.owner_name}</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e_area">Área *</Label>
                <Select
                  id="e_area"
                  required
                  value={form.area}
                  onChange={(e) => handleAreaChange(e.target.value as ServiceType | "")}
                >
                  <option value="">Seleccionar área...</option>
                  <option value="veterinary">Veterinaria</option>
                  <option value="grooming">Peluquería</option>
                  <option value="aesthetic">Estética</option>
                </Select>
              </div>

              {form.area && (
                <div className="space-y-1.5">
                  <Label>Servicios * (uno o más)</Label>
                  <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                    {servicesInArea.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        No hay servicios configurados para esta área
                      </p>
                    ) : (
                      servicesInArea.map((s) => {
                        const checked = form.service_ids.includes(s.id)
                        return (
                          <label
                            key={s.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleService(s.id)}
                            />
                            <span className="flex-1 text-sm">
                              {s.name}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({s.duration_minutes} min)
                              </span>
                            </span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="e_assignee">Profesional *</Label>
                <Select
                  id="e_assignee"
                  required
                  value={selectedAssignee?.id ?? editing.assigned_user_id}
                  onChange={(e) => {
                    const u = users.find((u) => u.id === e.target.value)
                    setSelectedAssignee(u ?? null)
                  }}
                >
                  {usersInArea.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role_name})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="e_date">Fecha *</Label>
                  <Input
                    id="e_date"
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e_time">Hora *</Label>
                  <Input
                    id="e_time"
                    type="time"
                    required
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e_status">Estado</Label>
                <Select
                  id="e_status"
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as AppointmentStatus })
                  }
                >
                  <option value="pending">Pendiente</option>
                  <option value="confirmed">Confirmada</option>
                  <option value="cancelled">Cancelada</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e_notes">Notas</Label>
                <Textarea
                  id="e_notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
          ) : (
            // ── CREATE MODE: layout 2-columnas ─────────────────────────────────
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_360px] gap-6">
              {/* IZQUIERDA: form */}
              <div className="space-y-5">
                {/* DETALLES */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Detalles
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="c_area">Área *</Label>
                      <Select
                        id="c_area"
                        required
                        value={form.area}
                        onChange={(e) => handleAreaChange(e.target.value as ServiceType | "")}
                      >
                        <option value="">Seleccionar área...</option>
                        <option value="veterinary">Veterinaria</option>
                        <option value="grooming">Peluquería</option>
                        <option value="aesthetic">Estética</option>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Duración total</Label>
                      <div className="h-9 px-3 rounded-md border border-input bg-muted/30 flex items-center text-sm text-muted-foreground">
                        {duration ? `${duration} min` : "—"}
                      </div>
                    </div>
                  </div>

                  {form.area && (
                    <div className="space-y-1.5">
                      <Label>Servicios * (uno o más)</Label>
                      {selectedServices.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {selectedServices.map((s) => (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs"
                            >
                              {s.name}
                              <button
                                type="button"
                                onClick={() => toggleService(s.id)}
                                className="hover:text-destructive"
                                aria-label={`Quitar ${s.name}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="rounded-md border divide-y max-h-40 overflow-y-auto">
                        {servicesInArea.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-muted-foreground">
                            No hay servicios configurados para esta área
                          </p>
                        ) : (
                          servicesInArea
                            .filter((s) => !form.service_ids.includes(s.id))
                            .map((s) => (
                              <button
                                type="button"
                                key={s.id}
                                onClick={() => toggleService(s.id)}
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 text-left"
                              >
                                <span className="text-sm">{s.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {s.duration_minutes} min
                                </span>
                              </button>
                            ))
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="c_date">Fecha *</Label>
                      <Input
                        id="c_date"
                        type="date"
                        required
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c_time">Comienza *</Label>
                      <Input
                        id="c_time"
                        type="time"
                        required
                        value={form.time}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Finaliza</Label>
                      <div className="h-9 px-3 rounded-md border border-input bg-muted/30 flex items-center text-sm text-muted-foreground">
                        {endTime || "—"}
                      </div>
                    </div>
                  </div>

                  {/* Mensaje si no hay área seleccionada */}
                  {!form.area && (
                    <p className="text-xs text-muted-foreground">
                      Seleccioná un área para ver los servicios disponibles.
                    </p>
                  )}

                  {!showNotes ? (
                    <button
                      type="button"
                      onClick={() => setShowNotes(true)}
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar notas
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="c_notes">Notas</Label>
                      <Textarea
                        id="c_notes"
                        rows={2}
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                {/* ASOCIACIONES */}
                <div className="space-y-3 pt-3 border-t">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Asociaciones
                  </p>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      Propietario *
                    </Label>
                    <OwnerCombobox value={selectedOwner} onChange={handleOwnerChange} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <PawPrint className="h-3.5 w-3.5 text-muted-foreground" />
                      Mascota *
                    </Label>
                    <PatientCombobox
                      ownerId={selectedOwner?.id ?? null}
                      value={selectedPatient}
                      onChange={setSelectedPatient}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                      Profesional *
                    </Label>
                    <AssigneeCombobox
                      value={selectedAssignee}
                      onChange={setSelectedAssignee}
                      areaFilter={form.area || null}
                    />
                  </div>
                </div>
              </div>

              {/* DERECHA: timeline visual del día */}
              <div className="rounded-lg border bg-card overflow-hidden h-[520px]">
                {form.date ? (
                  <DayTimeline
                    date={new Date(form.date + "T00:00:00")}
                    onPrevDay={() => setForm({ ...form, date: shiftDate(form.date, -1) })}
                    onNextDay={() => setForm({ ...form, date: shiftDate(form.date, 1) })}
                    newStartISO={newStartISO}
                    newDurationMinutes={duration || null}
                    existingAppointments={dayAppts}
                    services={services}
                    selectedServiceIds={form.service_ids}
                    selectedAssigneeId={selectedAssignee?.id ?? null}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
                    Elegí una fecha para ver disponibilidad
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 mt-5 border-t gap-4">
            <p className={`text-sm text-destructive ${error ? "" : "invisible"}`}>
              {error || "placeholder"}
            </p>
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={closeForm}>
                {justCreated ? "Cerrar" : "Cancelar"}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving
                  ? "Guardando..."
                  : editing
                  ? "Guardar cambios"
                  : justCreated
                  ? "Crear otro servicio"
                  : "Crear cita"}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      {/* Confirmar cancelación */}
      <Dialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Cancelar cita"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Deseas cancelar la cita de{" "}
            <span className="font-medium text-foreground">{cancelTarget?.patient_name}</span>{" "}
            programada para el{" "}
            {cancelTarget &&
              new Date(cancelTarget.scheduled_at).toLocaleString("es", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            ?
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
            >
              {cancelMutation.isPending ? "Cancelando..." : "Cancelar cita"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Modal de atención */}
      {consultationAppt && (
        <ConsultationModal
          appointment={consultationAppt}
          onClose={() => setConsultationAppt(null)}
          onFinalized={() => setConsultationAppt(null)}
        />
      )}
    </div>
  )
}
