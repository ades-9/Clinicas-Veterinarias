import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, XCircle } from "lucide-react"
import { useState } from "react"
import { useApiClient } from "@/api/client"
import { PatientSearch } from "@/components/PatientSearch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Appointment, AppointmentService, AppointmentStatus, Patient, User } from "@/types"

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

interface ApptForm {
  patient_id: string
  owner_id: string
  assigned_user_id: string
  service_id: string
  scheduled_at: string
  status: AppointmentStatus | ""
  notes: string
}

const EMPTY: ApptForm = {
  patient_id: "",
  owner_id: "",
  assigned_user_id: "",
  service_id: "",
  scheduled_at: "",
  status: "",
  notes: "",
}

export function AppointmentsPage() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [form, setForm] = useState<ApptForm>(EMPTY)
  const [error, setError] = useState("")

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", statusFilter],
    queryFn: () =>
      api.get<Appointment[]>(
        `/appointments?limit=100${statusFilter ? `&status=${statusFilter}` : ""}`
      ),
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

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post<Appointment>("/appointments", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["appointments"] }); closeForm() },
    onError: (e: Error) => setError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api.patch<Appointment>(`/appointments/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["appointments"] }); closeForm() },
    onError: (e: Error) => setError(e.message),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.del(`/appointments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      setCancelTarget(null)
    },
    onError: (e: Error) => setError(e.message),
  })

  function openCreate() {
    setEditing(null)
    setSelectedPatient(null)
    setForm(EMPTY)
    setError("")
    setFormOpen(true)
  }

  function openEdit(appt: Appointment) {
    setEditing(appt)
    setSelectedPatient(null)
    setForm({
      patient_id: appt.patient_id,
      owner_id: appt.owner_id,
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
  }

  function handlePatientChange(patient: Patient | null) {
    setSelectedPatient(patient)
    setForm((f) => ({
      ...f,
      patient_id: patient?.id ?? "",
      owner_id: patient?.owner_id ?? "",
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Citas</h1>
          <p className="text-sm text-muted-foreground">Gestión de citas veterinarias</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva cita
        </Button>
      </div>

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

      {/* Crear / Editar */}
      <Dialog
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Editar cita" : "Nueva cita"}
        className="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {editing ? (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Paciente: </span>
              <span className="font-medium">{editing.patient_name}</span>
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
                <option value="attended">Atendida</option>
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
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : editing ? "Guardar cambios" : "Crear cita"}
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
    </div>
  )
}
