import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Eye, Plus } from "lucide-react"
import { useState } from "react"
import { useApiClient } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { MedicalRecord, Patient, User } from "@/types"

interface RecordForm {
  patient_id: string
  veterinarian_id: string
  reason: string
  diagnosis: string
  treatment: string
  prescriptions: string
  weight: string
  temperature: string
  visit_date: string
}

const EMPTY: RecordForm = {
  patient_id: "",
  veterinarian_id: "",
  reason: "",
  diagnosis: "",
  treatment: "",
  prescriptions: "",
  weight: "",
  temperature: "",
  visit_date: new Date().toISOString().slice(0, 10),
}

export function MedicalRecordsPage() {
  const api = useApiClient()
  const queryClient = useQueryClient()

  const [patientFilter, setPatientFilter] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [viewRecord, setViewRecord] = useState<MedicalRecord | null>(null)
  const [form, setForm] = useState<RecordForm>(EMPTY)
  const [error, setError] = useState("")

  const { data: allPatients = [] } = useQuery({
    queryKey: ["patients"],
    queryFn: () => api.get<Patient[]>("/patients?limit=200"),
  })

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["medical-records", patientFilter],
    queryFn: () =>
      api.get<MedicalRecord[]>(
        `/medical-records?limit=100${patientFilter ? `&patient_id=${patientFilter}` : ""}`
      ),
  })

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users?limit=200"),
    enabled: formOpen,
  })

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post<MedicalRecord>("/medical-records", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] })
      closeForm()
    },
    onError: (e: Error) => setError(e.message),
  })

  function openCreate() {
    setForm(EMPTY)
    setError("")
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setForm(EMPTY)
    setError("")
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    createMutation.mutate({
      patient_id: form.patient_id,
      veterinarian_id: form.veterinarian_id,
      reason: form.reason,
      diagnosis: form.diagnosis || null,
      treatment: form.treatment || null,
      prescriptions: form.prescriptions || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      temperature: form.temperature ? parseFloat(form.temperature) : null,
      visit_date: form.visit_date,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Historia Clínica</h1>
          <p className="text-sm text-muted-foreground">Registros médicos de pacientes</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva consulta
        </Button>
      </div>

      <Select
        className="w-60"
        value={patientFilter}
        onChange={(e) => setPatientFilter(e.target.value)}
      >
        <option value="">Todos los pacientes</option>
        {allPatients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Paciente</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Motivo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Diagnóstico</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Veterinario</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Cargando...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No hay registros médicos
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr
                  key={record.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(record.visit_date).toLocaleDateString("es")}
                  </td>
                  <td className="px-4 py-3 font-medium">{record.patient_name}</td>
                  <td className="px-4 py-3">{record.reason}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {record.diagnosis ? (
                      <span className="line-clamp-1">{record.diagnosis}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{record.veterinarian_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => setViewRecord(record)}
                        className="rounded p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Nueva consulta */}
      <Dialog
        open={formOpen}
        onClose={closeForm}
        title="Nueva consulta"
        className="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="patient_id">Paciente *</Label>
            <Select
              id="patient_id"
              required
              value={form.patient_id}
              onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
            >
              <option value="">Seleccionar paciente...</option>
              {allPatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.owner_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="veterinarian_id">Veterinario *</Label>
            <Select
              id="veterinarian_id"
              required
              value={form.veterinarian_id}
              onChange={(e) => setForm({ ...form, veterinarian_id: e.target.value })}
            >
              <option value="">Seleccionar veterinario...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="visit_date">Fecha de consulta *</Label>
            <Input
              id="visit_date"
              type="date"
              required
              value={form.visit_date}
              onChange={(e) => setForm({ ...form, visit_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Motivo de consulta *</Label>
            <Textarea
              id="reason"
              required
              rows={2}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="weight">Peso (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                min="0"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="temperature">Temperatura (°C)</Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                min="0"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="diagnosis">Diagnóstico</Label>
            <Textarea
              id="diagnosis"
              rows={2}
              value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="treatment">Tratamiento</Label>
            <Textarea
              id="treatment"
              rows={2}
              value={form.treatment}
              onChange={(e) => setForm({ ...form, treatment: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prescriptions">Receta / Medicamentos</Label>
            <Textarea
              id="prescriptions"
              rows={2}
              value={form.prescriptions}
              onChange={(e) => setForm({ ...form, prescriptions: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Guardando..." : "Guardar consulta"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Detalle de consulta */}
      <Dialog
        open={viewRecord !== null}
        onClose={() => setViewRecord(null)}
        title="Detalle de consulta"
        className="max-w-lg"
      >
        {viewRecord && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-muted-foreground">Paciente</p>
                <p className="font-medium">{viewRecord.patient_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fecha</p>
                <p className="font-medium">
                  {new Date(viewRecord.visit_date).toLocaleDateString("es", {
                    dateStyle: "long",
                  })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Veterinario</p>
                <p className="font-medium">{viewRecord.veterinarian_name}</p>
              </div>
              {(viewRecord.weight || viewRecord.temperature) && (
                <div>
                  <p className="text-muted-foreground">Peso / Temperatura</p>
                  <p className="font-medium">
                    {viewRecord.weight != null ? `${viewRecord.weight} kg` : "—"}
                    {" / "}
                    {viewRecord.temperature != null ? `${viewRecord.temperature} °C` : "—"}
                  </p>
                </div>
              )}
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Motivo</p>
              <p>{viewRecord.reason}</p>
            </div>
            {viewRecord.diagnosis && (
              <div>
                <p className="text-muted-foreground mb-0.5">Diagnóstico</p>
                <p>{viewRecord.diagnosis}</p>
              </div>
            )}
            {viewRecord.treatment && (
              <div>
                <p className="text-muted-foreground mb-0.5">Tratamiento</p>
                <p>{viewRecord.treatment}</p>
              </div>
            )}
            {viewRecord.prescriptions && (
              <div>
                <p className="text-muted-foreground mb-0.5">Receta</p>
                <p>{viewRecord.prescriptions}</p>
              </div>
            )}
            {viewRecord.vaccinations.length > 0 && (
              <div>
                <p className="text-muted-foreground font-medium mb-1">Vacunas</p>
                <ul className="space-y-1">
                  {viewRecord.vaccinations.map((v) => (
                    <li key={v.id} className="flex justify-between">
                      <span>{v.vaccine_name}</span>
                      <span className="text-muted-foreground">
                        {new Date(v.applied_at).toLocaleDateString("es")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {viewRecord.attachments.length > 0 && (
              <div>
                <p className="text-muted-foreground font-medium mb-1">Archivos adjuntos</p>
                <ul className="space-y-1">
                  {viewRecord.attachments.map((a) => (
                    <li key={a.id}>
                      <a
                        href={a.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {a.file_name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
