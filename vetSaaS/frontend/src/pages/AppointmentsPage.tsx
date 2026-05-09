import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, List, Pencil, PlayCircle, Plus, User as UserIcon, PawPrint, Stethoscope, XCircle } from "lucide-react"
import { useMemo, useState } from "react"
import { useApiClient } from "@/api/client"
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
  User,
} from "@/types"

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

function toISOLocal(date: Date) {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

// ── Form types ────────────────────────────────────────────────────────────────

interface ApptForm {
  service_id: string
  date: string         // YYYY-MM-DD
  time: string         // HH:MM
  status: AppointmentStatus | ""
  notes: string
}

const EMPTY: ApptForm = {
  service_id: "",
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
        `/appointments?date_from=${encodeURIComponent(toISOLocal(calWeekStart))}&date_to=${encodeURIComponent(toISOLocal(calWeekEnd))}&limit=200`
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
        `/appointments?date_from=${formDate}T00:00:00&date_to=${formDate}T23:59:59&limit=200`
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

  const selectedService = useMemo(
    () => services.find((s) => s.id === form.service_id) ?? null,
    [services, form.service_id]
  )
  const duration = selectedService?.duration_minutes ?? 0
  const endTime = computeEndTime(form.time, duration)
  const newStartISO = form.date && form.time ? `${form.date}T${form.time}:00` : null

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post<Appointment>("/appointments", data),
    onSuccess: () => {
      invalidateAll()
      setJustCreated({ patientName: selectedPatient?.name ?? "el paciente" })
      // Keep owner+patient+date for quick second booking; reset service/time/assignee/notes
      setForm((f) => ({ ...f, service_id: "", time: "", notes: "", status: "" }))
      setSelectedAssignee(null)
      setShowNotes(false)
      setError("")
    },
    onError: (e: Error) => setError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api.patch<Appointment>(`/appointments/${id}`, data),
    onSuccess: () => { invalidateAll(); closeForm() },
    onError: (e: Error) => setError(e.message),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.del(`/appointments/${id}`),
    onSuccess: () => { invalidateAll(); setCancelTarget(null) },
    onError: (e: Error) => setError(e.message),
  })

  function openCreate() {
    setEditing(null)
    setSelectedOwner(null)
    setSelectedPatient(null)
    setSelectedAssignee(null)
    setShowNotes(false)
    setForm({ ...EMPTY, date: new Date().toLocaleDateString("en-CA") })
    setError("")
    setJustCreated(null)
    setFormOpen(true)
  }

  function openEdit(appt: Appointment) {
    setEditing(appt)
    setSelectedOwner(null) // edit no usa combobox
    setSelectedPatient(null)
    setSelectedAssignee(null)
    setShowNotes(!!appt.notes)
    setJustCreated(null)
    const d = new Date(appt.scheduled_at)
    setForm({
      service_id: appt.service_id,
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
    const scheduledAt = form.date && form.time ? `${form.date}T${form.time}:00` : ""
    if (!form.service_id) { setError("Selecciona un servicio"); return }
    if (!scheduledAt) { setError("Selecciona fecha y hora"); return }

    if (editing) {
      if (!selectedAssignee && !editing.assigned_user_id) {
        setError("Selecciona un profesional")
        return
      }
      updateMutation.mutate({
        id: editing.id,
        data: {
          assigned_user_id: selectedAssignee?.id ?? editing.assigned_user_id,
          service_id: form.service_id,
          scheduled_at: scheduledAt,
          status: form.status || undefined,
          notes: form.notes || null,
        },
      })
    } else {
      if (!selectedOwner) { setError("Selecciona un propietario"); return }
      if (!selectedPatient) { setError("Selecciona un paciente"); return }
      if (!selectedAssignee) { setError("Selecciona un profesional"); return }
      createMutation.mutate({
        patient_id: selectedPatient.id,
        owner_id: selectedOwner.id,
        assigned_user_id: selectedAssignee.id,
        service_id: form.service_id,
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
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nueva cita
          </Button>
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Paciente</th>
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
                    <td className="px-4 py-3 font-medium">{appt.patient_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{appt.owner_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{appt.service_name}</td>
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
            // ── EDIT MODE: form simple (no se puede cambiar paciente/owner) ─────
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Paciente: </span>
                <span className="font-medium">{editing.patient_name}</span>
                <span className="text-muted-foreground ml-3">Propietario: </span>
                <span className="font-medium">{editing.owner_name}</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e_service">Servicio *</Label>
                <Select
                  id="e_service"
                  required
                  value={form.service_id}
                  onChange={(e) => setForm({ ...form, service_id: e.target.value })}
                >
                  <option value="">Seleccionar servicio...</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes} min)
                    </option>
                  ))}
                </Select>
              </div>

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
                  {users.map((u) => (
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
                  <div className="space-y-1.5">
                    <Label htmlFor="c_service">Servicio *</Label>
                    <Select
                      id="c_service"
                      required
                      value={form.service_id}
                      onChange={(e) => setForm({ ...form, service_id: e.target.value })}
                    >
                      <option value="">Seleccionar servicio...</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.duration_minutes} min)
                        </option>
                      ))}
                    </Select>
                  </div>

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
                      Paciente *
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
                    <AssigneeCombobox value={selectedAssignee} onChange={setSelectedAssignee} />
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
                    selectedServiceId={form.service_id || null}
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
