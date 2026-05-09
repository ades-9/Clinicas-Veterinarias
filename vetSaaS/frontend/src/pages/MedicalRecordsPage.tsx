import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, BookOpen, Bug, Paperclip, Plus, Scissors, Search, Syringe } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useApiClient } from "@/api/client"
import { DewormingDialog } from "@/components/DewormingDialog"
import { PatientSearch } from "@/components/PatientSearch"
import { SurgeryDialog } from "@/components/SurgeryDialog"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Deworming, MedicalRecord, Patient, Surgery, User } from "@/types"

// ── Formulario nueva consulta ─────────────────────────────────────────────────

interface RecordForm {
  patient_id: string
  veterinarian_id: string
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
  visit_date: string
}

const EMPTY_FORM: RecordForm = {
  patient_id: "",
  veterinarian_id: "",
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
  visit_date: new Date().toISOString().slice(0, 10),
}

interface NewRecordDialogProps {
  open: boolean
  onClose: () => void
  initialPatient: Patient | null
}

function NewRecordDialog({ open, onClose, initialPatient }: NewRecordDialogProps) {
  const api = useApiClient()
  const queryClient = useQueryClient()
  const [formPatient, setFormPatient] = useState<Patient | null>(null)
  const [form, setForm] = useState<RecordForm>(EMPTY_FORM)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setFormPatient(initialPatient)
      setForm({ ...EMPTY_FORM, patient_id: initialPatient?.id ?? "" })
      setError("")
    }
  }, [open, initialPatient])

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (data: object) => api.post<MedicalRecord>("/medical-records", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  function handlePatientChange(patient: Patient | null) {
    setFormPatient(patient)
    setForm((f) => ({ ...f, patient_id: patient?.id ?? "" }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.patient_id) { setError("Selecciona un paciente"); return }
    mutation.mutate({
      patient_id: form.patient_id,
      veterinarian_id: form.veterinarian_id,
      reason: form.reason,
      diagnosis: form.diagnosis || null,
      treatment: form.treatment || null,
      prescriptions: form.prescriptions || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      temperature: form.temperature ? parseFloat(form.temperature) : null,
      heart_rate: form.heart_rate ? parseInt(form.heart_rate, 10) : null,
      respiratory_rate: form.respiratory_rate ? parseInt(form.respiratory_rate, 10) : null,
      pulse: form.pulse || null,
      physical_exam: form.physical_exam || null,
      visit_date: form.visit_date,
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nueva consulta" className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Datos generales */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos generales</p>
          <div className="space-y-1.5">
            <Label>Paciente *</Label>
            <PatientSearch value={formPatient} onChange={handlePatientChange} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vet_id">Veterinario *</Label>
              <Select
                id="vet_id"
                required
                value={form.veterinarian_id}
                onChange={(e) => setForm({ ...form, veterinarian_id: e.target.value })}
              >
                <option value="">Seleccionar veterinario...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visit_date">Fecha *</Label>
              <Input
                id="visit_date"
                type="date"
                required
                value={form.visit_date}
                onChange={(e) => setForm({ ...form, visit_date: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* S — Subjetivo */}
        <div className="space-y-3 pt-3 border-t">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            S — Subjetivo (anamnesis)
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Motivo de consulta *</Label>
            <Textarea
              id="reason"
              required
              rows={2}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Síntomas descritos por el dueño, duración, antecedentes..."
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
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="heart_rate">FC (lpm)</Label>
              <Input
                id="heart_rate"
                type="number"
                min="0"
                value={form.heart_rate}
                onChange={(e) => setForm({ ...form, heart_rate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="respiratory_rate">FR (rpm)</Label>
              <Input
                id="respiratory_rate"
                type="number"
                min="0"
                value={form.respiratory_rate}
                onChange={(e) => setForm({ ...form, respiratory_rate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pulse">Pulso</Label>
              <Input
                id="pulse"
                value={form.pulse}
                onChange={(e) => setForm({ ...form, pulse: e.target.value })}
                placeholder="Ej. fuerte y regular"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="physical_exam">Examen físico</Label>
            <Textarea
              id="physical_exam"
              rows={3}
              value={form.physical_exam}
              onChange={(e) => setForm({ ...form, physical_exam: e.target.value })}
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
            <Label htmlFor="diagnosis">Diagnóstico presuntivo o definitivo</Label>
            <Textarea id="diagnosis" rows={2} value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
          </div>
        </div>

        {/* P — Plan */}
        <div className="space-y-3 pt-3 border-t">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            P — Plan (tratamiento)
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="treatment">Tratamiento</Label>
            <Textarea id="treatment" rows={2} value={form.treatment}
              onChange={(e) => setForm({ ...form, treatment: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prescriptions">Receta / Medicamentos</Label>
            <Textarea
              id="prescriptions"
              rows={2}
              value={form.prescriptions}
              onChange={(e) => setForm({ ...form, prescriptions: e.target.value })}
              placeholder="Medicamento, concentración, dosis, frecuencia, duración..."
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando..." : "Guardar consulta"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ── Vista de expediente por paciente ─────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { dateStyle: "long" })
}

function RecordCard({ record }: { record: MedicalRecord }) {
  const [dewormingOpen, setDewormingOpen] = useState(false)
  const [surgeryOpen, setSurgeryOpen] = useState(false)

  const hasVitals =
    record.weight != null ||
    record.temperature != null ||
    record.heart_rate != null ||
    record.respiratory_rate != null ||
    record.pulse != null

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4 text-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-base">{formatDate(record.visit_date)}</p>
          <p className="text-muted-foreground">Atendido por {record.veterinarian_name}</p>
        </div>
        {hasVitals && (
          <div className="text-right text-xs text-muted-foreground bg-muted/50 rounded px-3 py-1.5 shrink-0 space-y-0.5">
            {record.weight != null && <p>Peso: <span className="font-medium text-foreground">{record.weight} kg</span></p>}
            {record.temperature != null && <p>Temp: <span className="font-medium text-foreground">{record.temperature} °C</span></p>}
            {record.heart_rate != null && <p>FC: <span className="font-medium text-foreground">{record.heart_rate} lpm</span></p>}
            {record.respiratory_rate != null && <p>FR: <span className="font-medium text-foreground">{record.respiratory_rate} rpm</span></p>}
            {record.pulse && <p>Pulso: <span className="font-medium text-foreground">{record.pulse}</span></p>}
          </div>
        )}
      </div>

      {/* S — Motivo */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Motivo (S)</p>
        <p>{record.reason}</p>
      </div>

      {/* O — Examen físico */}
      {record.physical_exam && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Examen físico (O)</p>
          <p className="whitespace-pre-line">{record.physical_exam}</p>
        </div>
      )}

      {/* A — Diagnóstico */}
      {record.diagnosis && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Diagnóstico (A)</p>
          <p>{record.diagnosis}</p>
        </div>
      )}

      {/* P — Tratamiento */}
      {record.treatment && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Tratamiento (P)</p>
          <p>{record.treatment}</p>
        </div>
      )}

      {/* P — Receta */}
      {record.prescriptions && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Receta (P)</p>
          <p className="whitespace-pre-line">{record.prescriptions}</p>
        </div>
      )}

      {/* Vacunas */}
      {record.vaccinations.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <Syringe className="h-3.5 w-3.5" /> Vacunas aplicadas
          </p>
          <ul className="space-y-1">
            {record.vaccinations.map((v) => (
              <li key={v.id} className="flex justify-between text-xs">
                <span className="font-medium">{v.vaccine_name}</span>
                <span className="text-muted-foreground">
                  {new Date(v.applied_at).toLocaleDateString("es")}
                  {v.next_dose_at && ` · próxima: ${new Date(v.next_dose_at).toLocaleDateString("es")}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Desparasitaciones */}
      {record.dewormings.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <Bug className="h-3.5 w-3.5" /> Desparasitaciones
          </p>
          <ul className="space-y-1">
            {record.dewormings.map((d) => (
              <li key={d.id} className="flex justify-between text-xs">
                <span>
                  <span className="font-medium">{d.product_name}</span>
                  <span className="text-muted-foreground ml-2">
                    ({d.treatment_type === "internal" ? "interna" : d.treatment_type === "external" ? "externa" : "ambas"})
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {new Date(d.applied_at).toLocaleDateString("es")}
                  {d.next_dose_at && ` · próxima: ${new Date(d.next_dose_at).toLocaleDateString("es")}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cirugías */}
      {record.surgeries.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <Scissors className="h-3.5 w-3.5" /> Cirugías
          </p>
          <ul className="space-y-1">
            {record.surgeries.map((s) => (
              <li key={s.id} className="text-xs">
                <div className="flex justify-between">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">
                    {new Date(s.performed_at).toLocaleDateString("es")}
                    {s.veterinarian_name && ` · ${s.veterinarian_name}`}
                  </span>
                </div>
                {s.description && <p className="text-muted-foreground mt-0.5">{s.description}</p>}
                {s.complications && (
                  <p className="text-destructive mt-0.5">Complicaciones: {s.complications}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Adjuntos */}
      {record.attachments.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <Paperclip className="h-3.5 w-3.5" /> Archivos
          </p>
          <ul className="space-y-1">
            {record.attachments.map((a) => (
              <li key={a.id}>
                <a href={a.file_url} target="_blank" rel="noreferrer"
                  className="text-xs text-primary hover:underline">
                  {a.file_name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap gap-2 pt-3 border-t">
        <Button size="sm" variant="outline" onClick={() => setDewormingOpen(true)}>
          <Bug className="h-3.5 w-3.5" />
          Desparasitación
        </Button>
        <Button size="sm" variant="outline" onClick={() => setSurgeryOpen(true)}>
          <Scissors className="h-3.5 w-3.5" />
          Cirugía
        </Button>
      </div>

      <DewormingDialog
        open={dewormingOpen}
        onClose={() => setDewormingOpen(false)}
        patientId={record.patient_id}
        patientName={record.patient_name}
        recordId={record.id}
      />
      <SurgeryDialog
        open={surgeryOpen}
        onClose={() => setSurgeryOpen(false)}
        patientId={record.patient_id}
        patientName={record.patient_name}
        recordId={record.id}
      />
    </div>
  )
}

interface PatientHistoryViewProps {
  patientId: string
  onBack: () => void
  onNewRecord: () => void
}

function PatientHistoryView({ patientId, onBack, onNewRecord }: PatientHistoryViewProps) {
  const api = useApiClient()
  const [dewormingDialogOpen, setDewormingDialogOpen] = useState(false)
  const [surgeryDialogOpen, setSurgeryDialogOpen] = useState(false)

  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => api.get<Patient>(`/patients/${patientId}`),
  })

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["medical-records", patientId],
    queryFn: () =>
      api.get<MedicalRecord[]>(`/medical-records?patient_id=${patientId}&limit=500`),
  })

  const { data: allDewormings = [] } = useQuery({
    queryKey: ["patient-dewormings", patientId],
    queryFn: () => api.get<Deworming[]>(`/patients/${patientId}/dewormings`),
  })

  const { data: allSurgeries = [] } = useQuery({
    queryKey: ["patient-surgeries", patientId],
    queryFn: () => api.get<Surgery[]>(`/patients/${patientId}/surgeries`),
  })

  const standaloneDewormings = allDewormings.filter((d) => d.medical_record_id === null)
  const standaloneSurgeries = allSurgeries.filter((s) => s.medical_record_id === null)
  const hasAntecedentes = standaloneDewormings.length > 0 || standaloneSurgeries.length > 0

  const sorted = [...records].sort(
    (a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
  )

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Todos los registros
        </button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setDewormingDialogOpen(true)}>
            <Bug className="h-4 w-4" />
            Desparasitación
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSurgeryDialogOpen(true)}>
            <Scissors className="h-4 w-4" />
            Cirugía
          </Button>
          <Button onClick={onNewRecord}>
            <Plus className="h-4 w-4" />
            Nueva consulta
          </Button>
        </div>
      </div>

      {/* Ficha del paciente */}
      {patient && (
        <div className="rounded-lg border bg-card px-6 py-4 flex items-center gap-6">
          <div className="flex-1">
            <h2 className="text-xl font-bold">{patient.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {[patient.species_name, patient.breed_name].filter(Boolean).join(" · ")}
              {patient.owner_name && ` · Propietario: ${patient.owner_name}`}
            </p>
          </div>
          <div className="text-right text-sm shrink-0 space-y-0.5">
            {patient.vaccination_code && (
              <p className="text-muted-foreground">
                Cód. vacuna: <span className="font-medium text-foreground">{patient.vaccination_code}</span>
              </p>
            )}
            {patient.birth_date && (
              <p className="text-muted-foreground">
                Nac.: <span className="font-medium text-foreground">
                  {new Date(patient.birth_date).toLocaleDateString("es")}
                </span>
              </p>
            )}
            <p className="text-muted-foreground">
              {records.length} consulta{records.length !== 1 ? "s" : ""} registrada{records.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Antecedentes (registros sin consulta asociada) */}
      {hasAntecedentes && (
        <div className="rounded-lg border bg-card p-5 space-y-4 text-sm">
          <p className="font-semibold text-base">Antecedentes (sin consulta asociada)</p>

          {standaloneDewormings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Bug className="h-3.5 w-3.5" /> Desparasitaciones
              </p>
              <ul className="space-y-1">
                {standaloneDewormings.map((d) => (
                  <li key={d.id} className="text-xs">
                    <div className="flex justify-between">
                      <span>
                        <span className="font-medium">{d.product_name}</span>
                        <span className="text-muted-foreground ml-2">
                          ({d.treatment_type === "internal" ? "interna" : d.treatment_type === "external" ? "externa" : "ambas"})
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(d.applied_at).toLocaleDateString("es")}
                        {d.next_dose_at && ` · próxima: ${new Date(d.next_dose_at).toLocaleDateString("es")}`}
                      </span>
                    </div>
                    {d.notes && <p className="text-muted-foreground mt-0.5">{d.notes}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {standaloneSurgeries.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Scissors className="h-3.5 w-3.5" /> Cirugías
              </p>
              <ul className="space-y-1">
                {standaloneSurgeries.map((s) => (
                  <li key={s.id} className="text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground">
                        {new Date(s.performed_at).toLocaleDateString("es")}
                        {s.veterinarian_name && ` · ${s.veterinarian_name}`}
                      </span>
                    </div>
                    {s.description && <p className="text-muted-foreground mt-0.5">{s.description}</p>}
                    {s.complications && (
                      <p className="text-destructive mt-0.5">Complicaciones: {s.complications}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando historial...</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Sin consultas registradas para este paciente</p>
          <Button variant="outline" className="mt-4" onClick={onNewRecord}>
            Registrar primera consulta
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <DewormingDialog
        open={dewormingDialogOpen}
        onClose={() => setDewormingDialogOpen(false)}
        patientId={patientId}
        patientName={patient?.name}
      />
      <SurgeryDialog
        open={surgeryDialogOpen}
        onClose={() => setSurgeryDialogOpen(false)}
        patientId={patientId}
        patientName={patient?.name}
      />
    </div>
  )
}

// ── Búsqueda simple de paciente (para filtro de la tabla) ─────────────────────

interface PatientFilterProps {
  onSelect: (patientId: string) => void
}

function PatientFilter({ onSelect }: PatientFilterProps) {
  const api = useApiClient()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["patients-search", debouncedQuery],
    queryFn: () =>
      api.get<Patient[]>(`/patients?q=${encodeURIComponent(debouncedQuery)}&limit=20`),
    enabled: debouncedQuery.length > 0,
    staleTime: 30_000,
  })

  return (
    <div ref={containerRef} className="relative w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        className="pl-9"
        placeholder="Ver expediente de paciente..."
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
      />
      {open && debouncedQuery.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-lg overflow-hidden">
          {isFetching ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => { onSelect(p.id); setQuery(""); setOpen(false) }}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground ml-2">— {p.owner_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ── Vista de tabla (pacientes únicos con última consulta) ─────────────────────

interface PatientSummary {
  patient_id: string
  patient_name: string
  last_visit: string
  consultation_count: number
  last_reason: string
  last_vet: string
}

interface AllRecordsViewProps {
  onSelectPatient: (id: string) => void
  onNewRecord: () => void
}

function AllRecordsView({ onSelectPatient, onNewRecord }: AllRecordsViewProps) {
  const api = useApiClient()

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["medical-records", "all"],
    queryFn: () => api.get<MedicalRecord[]>("/medical-records?limit=500"),
    staleTime: 0,
  })

  // Group by patient_id — one row per patient, sorted by most recent visit
  const patientSummaries: PatientSummary[] = Object.values(
    records.reduce((acc, r) => {
      if (!acc[r.patient_id]) {
        acc[r.patient_id] = {
          patient_id: r.patient_id,
          patient_name: r.patient_name,
          last_visit: r.visit_date,
          consultation_count: 1,
          last_reason: r.reason,
          last_vet: r.veterinarian_name,
        }
      } else {
        acc[r.patient_id].consultation_count += 1
        if (new Date(r.visit_date) > new Date(acc[r.patient_id].last_visit)) {
          acc[r.patient_id].last_visit = r.visit_date
          acc[r.patient_id].last_reason = r.reason
          acc[r.patient_id].last_vet = r.veterinarian_name
        }
      }
      return acc
    }, {} as Record<string, PatientSummary>)
  ).sort((a, b) => new Date(b.last_visit).getTime() - new Date(a.last_visit).getTime())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Historia Clínica</h1>
          <p className="text-sm text-muted-foreground">Expedientes de pacientes</p>
        </div>
        <Button onClick={onNewRecord}>
          <Plus className="h-4 w-4" />
          Nueva consulta
        </Button>
      </div>

      <PatientFilter onSelect={onSelectPatient} />

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Paciente</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Última consulta</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Último motivo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Veterinario</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Consultas</th>
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
            ) : patientSummaries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No hay registros médicos
                </td>
              </tr>
            ) : (
              patientSummaries.map((ps) => (
                <tr
                  key={ps.patient_id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => onSelectPatient(ps.patient_id)}
                >
                  <td className="px-4 py-3 font-medium">{ps.patient_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(ps.last_visit).toLocaleDateString("es")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="line-clamp-1">{ps.last_reason}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ps.last_vet}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {ps.consultation_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-primary hover:underline">
                      Ver expediente →
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function MedicalRecordsPage() {
  const [historyPatientId, setHistoryPatientId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formInitialPatient, setFormInitialPatient] = useState<Patient | null>(null)
  const api = useApiClient()

  const { data: historyPatient = null } = useQuery({
    queryKey: ["patient", historyPatientId],
    queryFn: () => api.get<Patient>(`/patients/${historyPatientId}`),
    enabled: historyPatientId !== null && formOpen,
  })

  function openCreate(patient?: Patient) {
    setFormInitialPatient(patient ?? null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setFormInitialPatient(null)
  }

  return (
    <>
      {historyPatientId ? (
        <PatientHistoryView
          patientId={historyPatientId}
          onBack={() => setHistoryPatientId(null)}
          onNewRecord={() => {
            setFormInitialPatient(historyPatient)
            setFormOpen(true)
          }}
        />
      ) : (
        <AllRecordsView
          onSelectPatient={setHistoryPatientId}
          onNewRecord={() => openCreate()}
        />
      )}

      <NewRecordDialog
        open={formOpen}
        onClose={closeForm}
        initialPatient={formInitialPatient}
      />
    </>
  )
}
