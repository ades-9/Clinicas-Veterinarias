import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, List, Pencil, PlayCircle, Plus, XCircle } from "lucide-react"
import { useState } from "react"
import { useApiClient } from "@/api/client"
import { AppointmentCalendar, getWeekStart, addDays } from "@/components/AppointmentCalendar"
import { ConsultationModal } from "@/components/ConsultationModal"
import { PatientSearch } from "@/components/PatientSearch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Appointment, AppointmentService, AppointmentStatus, Patient, User } from "@/types"

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
  patient_id: string
  owner_id: string
  patient_display: string
  assigned_user_id: string
  service_id: string
  scheduled_at: string
  status: AppointmentStatus | ""
  notes: string
}

const EMPTY: ApptForm = {
  patient_id: "",
  owner_id: "",
  patient_display: "",
  assigned_user_id: "",
  service_id: "",
  scheduled_at: "",
  status: "",
  notes: "",
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
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
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
  })

  const { data: services = [] } = useQuery({
    queryKey: ["appointment-services"],
    queryFn: () => api.get<AppointmentService[]>("/appointment-services"),
    enabled: formOpen,
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["appointments"] })
    queryClient.invalidateQueries({ queryKey: ["appointments-today"] })
    queryClient.invalidateQueries({ queryKey: ["appointments-upcoming"] })
    queryClient.invalidateQueries({ queryKey: ["appointments-calendar"] })
  }

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post<Appointment>("/appointments", data),
    onSuccess: () => {
      invalidateAll()
      setJustCreated({ patientName: form.patient_display || "el paciente" })
      // Keep form open but reset service/user/notes to allow quick second booking
      setForm((f) => ({ ...f, service_id: "", assigned_user_id: "", notes: "", status: "" }))
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
    setSelectedPatient(null)
    setForm(EMPTY)
    setError("")
    setJustCreated(null)
    setFormOpen(true)
  }

  function openEdit(appt: Appointment) {
    setEditing(appt)
    setSelectedPatient(null)
    setJustCreated(null)
    setForm({
      patient_id: appt.patient_id,
      owner_id: appt.owner_id,
      patient_display: appt.patient_name,
      assigned_user_id: appt.assigned_user_id,
      service_id: appt.service_id,
      scheduled_at: appt.scheduled_at.slice(0, 16),
      status: appt.status,
      notes: appt.notes ?? "",
    })
    setError("")
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setSelectedPatient(null)
    setForm(EMPTY)
    setError("")
    setJustCreated(null)
  }

  function handlePatientChange(patient: Patient | null) {
    setSelectedPatient(patient)
    setForm((f) => ({
      ...f,
      patient_id: patient?.id ?? "",
      owner_id: patient?.owner_id ?? "",
      patient_display: patient?.name ?? "",
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!editing && !form.patient_id) {
      setError("Selecciona un paciente")
      return
    }
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        data: {
          assigned_user_id: form.assigned_user_id,
          service_id: form.service_id,
          scheduled_at: form.scheduled_at,
          status: form.status || undefined,
          notes: form.notes || null,
        },
      })
    } else {
      createMutation.mutate({
        patient_id: form.patient_id,
        owner_id: form.owner_id,
        assigned_user_id: form.assigned_user_id,
        service_id: form.service_id,
        scheduled_at: form.scheduled_at,
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
        className="max-w-lg"
      >
        {/* Success banner — "agendar otro servicio" */}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {editing ? (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Paciente: </span>
              <span className="font-medium">{editing.patient_name}</span>
            </div>
          ) : justCreated ? (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Paciente: </span>
              <span className="font-medium">{justCreated.patientName}</span>
              <span className="text-xs text-muted-foreground ml-2">(mismo horario)</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Paciente *</Label>
              <PatientSearch value={selectedPatient} onChange={handlePatientChange} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="service_id">Servicio *</Label>
            <Select
              id="service_id"
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
            <Label htmlFor="assigned_user_id">Asignado a *</Label>
            <Select
              id="assigned_user_id"
              required
              value={form.assigned_user_id}
              onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value })}
            >
              <option value="">Seleccionar usuario...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role_name})
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scheduled_at">Fecha y hora *</Label>
            <Input
              id="scheduled_at"
              type="datetime-local"
              required
              value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
            />
          </div>

          {editing && (
            <div className="space-y-1.5">
              <Label htmlFor="status">Estado</Label>
              <Select
                id="status"
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
          )}

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
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
