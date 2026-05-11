import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, BookOpen, Bug, Paperclip, Scissors, Search, Syringe } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useApiClient } from "@/api/client"
import { Input } from "@/components/ui/input"
import type { Deworming, MedicalRecord, Patient, ServiceType, Surgery, Vaccination } from "@/types"
import { SERVICE_TYPE_LABELS } from "@/types"

const AREA_BADGE_CLASS: Record<ServiceType, string> = {
  veterinary: "bg-blue-100 text-blue-800 border-blue-200",
  grooming: "bg-purple-100 text-purple-800 border-purple-200",
  aesthetic: "bg-pink-100 text-pink-800 border-pink-200",
}

function AreaBadge({ type }: { type: ServiceType | null }) {
  if (!type) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded border bg-muted text-muted-foreground">
        Sin cita
      </span>
    )
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${AREA_BADGE_CLASS[type]}`}>
      {SERVICE_TYPE_LABELS[type]}
    </span>
  )
}

function ExtBadge({ name }: { name: string | null }) {
  return (
    <span
      title={name ? `Aplicada en ${name}` : "Aplicada en otra clínica"}
      className="ml-1 inline-flex items-center rounded-full border border-amber-400 bg-amber-50 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-amber-700 align-middle"
    >
      Ext.{name ? ` · ${name}` : ""}
    </span>
  )
}


// ── Vista de expediente por mascota ─────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { dateStyle: "long" })
}

function RecordCard({ record }: { record: MedicalRecord }) {
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
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-base">{formatDate(record.visit_date)}</p>
            <AreaBadge type={record.appointment_service_type} />
          </div>
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

      {/* P — Receta (texto libre, histórico) */}
      {record.prescriptions && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Receta (P)</p>
          <p className="whitespace-pre-line">{record.prescriptions}</p>
        </div>
      )}

      {/* P — Prescripciones estructuradas */}
      {record.prescription_items.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Prescripciones (P)
          </p>
          <ul className="space-y-1 text-xs">
            {record.prescription_items.map((px) => (
              <li key={px.id} className="rounded bg-muted/30 px-2 py-1">
                <p className="font-medium">
                  {px.product_name || px.custom_name}
                  {px.custom_name && !px.product_name && (
                    <span className="text-muted-foreground ml-2">(manual)</span>
                  )}
                </p>
                {(px.dose || px.frequency || px.duration) && (
                  <p className="text-muted-foreground">
                    {[px.dose, px.frequency, px.duration].filter(Boolean).join(" · ")}
                  </p>
                )}
                {px.notes && (
                  <p className="text-muted-foreground italic mt-0.5">{px.notes}</p>
                )}
              </li>
            ))}
          </ul>
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
              <li key={v.id} className="flex items-center gap-2 text-xs">
                {v.photo_url && (
                  <a href={v.photo_url} target="_blank" rel="noreferrer" title="Ver etiqueta">
                    <img
                      src={v.photo_url}
                      alt="Etiqueta"
                      className="h-8 w-8 object-cover rounded border"
                    />
                  </a>
                )}
                <span className="flex-1">
                  <span className="font-medium">{v.vaccine_name}</span>
                  {v.applied_externally && <ExtBadge name={v.external_clinic_name} />}
                  {v.manufacturer && (
                    <span className="text-muted-foreground ml-2">{v.manufacturer}</span>
                  )}
                  {v.batch_number && (
                    <span className="text-muted-foreground ml-2">Lote: {v.batch_number}</span>
                  )}
                </span>
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
              <li key={d.id} className="flex items-center gap-2 text-xs">
                {d.photo_url && (
                  <a href={d.photo_url} target="_blank" rel="noreferrer" title="Ver etiqueta">
                    <img
                      src={d.photo_url}
                      alt="Etiqueta"
                      className="h-8 w-8 object-cover rounded border"
                    />
                  </a>
                )}
                <span className="flex-1">
                  <span className="font-medium">{d.product_name}</span>
                  {d.applied_externally && <ExtBadge name={d.external_clinic_name} />}
                  {d.manufacturer && (
                    <span className="text-muted-foreground ml-2">{d.manufacturer}</span>
                  )}
                  <span className="text-muted-foreground ml-2">
                    ({d.treatment_type === "internal" ? "interna" : d.treatment_type === "external" ? "externa" : "ambas"})
                  </span>
                  {d.batch_number && (
                    <span className="text-muted-foreground ml-2">Lote: {d.batch_number}</span>
                  )}
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
                  <span className="font-medium">
                    {s.name}
                    {s.applied_externally && <ExtBadge name={s.external_clinic_name} />}
                  </span>
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

    </div>
  )
}

interface PatientHistoryViewProps {
  patientId: string
  onBack: () => void
}

function PatientHistoryView({ patientId, onBack }: PatientHistoryViewProps) {
  const api = useApiClient()

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

  const { data: allVaccinations = [] } = useQuery({
    queryKey: ["patient-vaccinations", patientId],
    queryFn: () => api.get<Vaccination[]>(`/patients/${patientId}/vaccinations`),
  })

  // Antecedentes = items sin record_id (carnet previo, otra clínica, etc.)
  const standaloneDewormings = allDewormings.filter((d) => d.medical_record_id === null)
  const standaloneSurgeries = allSurgeries.filter((s) => s.medical_record_id === null)
  const standaloneVaccinations = allVaccinations.filter((v) => v.medical_record_id === null)
  const hasAntecedentes =
    standaloneDewormings.length > 0 ||
    standaloneSurgeries.length > 0 ||
    standaloneVaccinations.length > 0

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
      </div>

      {/* Ficha del mascota */}
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

          {standaloneVaccinations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Syringe className="h-3.5 w-3.5" /> Vacunas
              </p>
              <ul className="space-y-1">
                {standaloneVaccinations.map((v) => (
                  <li key={v.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      {v.photo_url && (
                        <a href={v.photo_url} target="_blank" rel="noreferrer" title="Ver etiqueta">
                          <img
                            src={v.photo_url}
                            alt="Etiqueta"
                            className="h-8 w-8 object-cover rounded border"
                          />
                        </a>
                      )}
                      <span className="flex-1">
                        <span className="font-medium">{v.vaccine_name}</span>
                        {v.applied_externally && <ExtBadge name={v.external_clinic_name} />}
                        {v.manufacturer && (
                          <span className="text-muted-foreground ml-2">{v.manufacturer}</span>
                        )}
                        {v.batch_number && (
                          <span className="text-muted-foreground ml-2">Lote: {v.batch_number}</span>
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(v.applied_at).toLocaleDateString("es")}
                        {v.next_dose_at &&
                          ` · próxima: ${new Date(v.next_dose_at).toLocaleDateString("es")}`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {standaloneDewormings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Bug className="h-3.5 w-3.5" /> Desparasitaciones
              </p>
              <ul className="space-y-1">
                {standaloneDewormings.map((d) => (
                  <li key={d.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      {d.photo_url && (
                        <a href={d.photo_url} target="_blank" rel="noreferrer" title="Ver etiqueta">
                          <img
                            src={d.photo_url}
                            alt="Etiqueta"
                            className="h-8 w-8 object-cover rounded border"
                          />
                        </a>
                      )}
                      <span className="flex-1">
                        <span className="font-medium">{d.product_name}</span>
                        {d.applied_externally && <ExtBadge name={d.external_clinic_name} />}
                        <span className="text-muted-foreground ml-2">
                          ({d.treatment_type === "internal" ? "interna" : d.treatment_type === "external" ? "externa" : "ambas"})
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(d.applied_at).toLocaleDateString("es")}
                        {d.next_dose_at && ` · próxima: ${new Date(d.next_dose_at).toLocaleDateString("es")}`}
                      </span>
                    </div>
                    {d.notes && <p className="text-muted-foreground mt-0.5 ml-10">{d.notes}</p>}
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
                      <span className="font-medium">
                        {s.name}
                        {s.applied_externally && <ExtBadge name={s.external_clinic_name} />}
                      </span>
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
          <p>Sin consultas registradas para esta mascota</p>
          <p className="text-xs mt-1">Las consultas se registran al atender una cita.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </div>
      )}

    </div>
  )
}

// ── Búsqueda simple de mascota (para filtro de la tabla) ─────────────────────

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
        placeholder="Ver expediente de mascota..."
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

// ── Vista de tabla (mascotas únicos con última consulta) ─────────────────────

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
}

function AllRecordsView({ onSelectPatient }: AllRecordsViewProps) {
  const api = useApiClient()
  const [areaFilter, setAreaFilter] = useState<ServiceType | "">("")

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["medical-records", "all", areaFilter],
    queryFn: () =>
      api.get<MedicalRecord[]>(
        `/medical-records?limit=500${areaFilter ? `&service_type=${areaFilter}` : ""}`
      ),
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
      <div>
        <h1 className="text-2xl font-bold">Historia Clínica</h1>
        <p className="text-sm text-muted-foreground">Expedientes de mascotas</p>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PatientFilter onSelect={onSelectPatient} />
        <div className="flex rounded-md border overflow-hidden">
          {([
            { value: "", label: "Todas las áreas" },
            { value: "veterinary", label: "Veterinaria" },
            { value: "grooming", label: "Peluquería" },
            { value: "aesthetic", label: "Estética" },
          ] as const).map((opt) => (
            <button
              key={opt.value || "all"}
              onClick={() => setAreaFilter(opt.value)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                areaFilter === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mascota</th>
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

  return (
    <>
      {historyPatientId ? (
        <PatientHistoryView
          patientId={historyPatientId}
          onBack={() => setHistoryPatientId(null)}
        />
      ) : (
        <AllRecordsView onSelectPatient={setHistoryPatientId} />
      )}
    </>
  )
}
