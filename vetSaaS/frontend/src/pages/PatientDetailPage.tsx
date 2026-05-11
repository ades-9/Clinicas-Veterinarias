import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Bug, Camera, ImagePlus, Printer, Scissors, Syringe } from "lucide-react"
import { useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useApiClient } from "@/api/client"
import { DewormingDialog } from "@/components/DewormingDialog"
import { SurgeryDialog } from "@/components/SurgeryDialog"
import { UpcomingDosesPanel } from "@/components/UpcomingDosesPanel"
import { VaccinationDialog } from "@/components/VaccinationDialog"
import { Button } from "@/components/ui/button"
import type { Deworming, Patient, Surgery, Vaccination } from "@/types"

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

export function PatientDetailPage() {
  const { id: patientId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const api = useApiClient()
  const qc = useQueryClient()
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [vaccinationOpen, setVaccinationOpen] = useState(false)
  const [dewormingOpen, setDewormingOpen] = useState(false)
  const [surgeryOpen, setSurgeryOpen] = useState(false)

  const photoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return api.upload<{ photo_url: string }>(
        `/patients/${patientId}/photo`,
        formData
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", patientId] })
      qc.invalidateQueries({ queryKey: ["patients"] })
    },
    onError: (e: Error) => alert(`No se pudo subir la foto: ${e.message}`),
  })

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => api.get<Patient>(`/patients/${patientId}`),
    enabled: !!patientId,
  })

  const { data: vaccinations = [] } = useQuery({
    queryKey: ["patient-vaccinations", patientId],
    queryFn: () => api.get<Vaccination[]>(`/patients/${patientId}/vaccinations`),
    enabled: !!patientId,
  })

  const { data: dewormings = [] } = useQuery({
    queryKey: ["patient-dewormings", patientId],
    queryFn: () => api.get<Deworming[]>(`/patients/${patientId}/dewormings`),
    enabled: !!patientId,
  })

  const { data: surgeries = [] } = useQuery({
    queryKey: ["patient-surgeries", patientId],
    queryFn: () => api.get<Surgery[]>(`/patients/${patientId}/surgeries`),
    enabled: !!patientId,
  })

  if (isLoading || !patient || !patientId) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>
  }

  // Antecedentes = items sin consulta asociada (carnet previo, otra clínica, etc.)
  const standaloneVacc = vaccinations.filter((v) => v.medical_record_id === null)
  const standaloneDew = dewormings.filter((d) => d.medical_record_id === null)
  const standaloneSurg = surgeries.filter((s) => s.medical_record_id === null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/patients")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Todas las mascotas
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/patients/${patientId}/carnet`)}
        >
          <Printer className="h-4 w-4" />
          Imprimir carnet
        </Button>
      </div>

      {/* Ficha */}
      <div className="rounded-lg border bg-card px-6 py-4">
        <div className="flex items-start gap-4">
          {/* Foto + uploader */}
          <div className="shrink-0">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) photoMutation.mutate(file)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoMutation.isPending}
              className="group relative h-24 w-24 rounded-lg border-2 border-dashed bg-muted overflow-hidden flex items-center justify-center hover:border-primary transition-colors disabled:opacity-60"
              title={patient.photo_url ? "Cambiar foto" : "Subir foto"}
            >
              {patient.photo_url ? (
                <>
                  <img
                    src={patient.photo_url}
                    alt={patient.name}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Camera className="h-5 w-5 text-white" />
                  </span>
                </>
              ) : (
                <span className="flex flex-col items-center text-muted-foreground text-[10px]">
                  <ImagePlus className="h-6 w-6 mb-1" />
                  {photoMutation.isPending ? "Subiendo..." : "Subir foto"}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 flex items-start justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{patient.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {[patient.species_name, patient.breed_name].filter(Boolean).join(" · ")}
                {patient.owner_name && ` · Propietario: ${patient.owner_name}`}
              </p>
            </div>
          <div className="text-right text-sm space-y-0.5">
            {patient.sex && (
              <p className="text-muted-foreground">
                Sexo:{" "}
                <span className="font-medium text-foreground">
                  {patient.sex === "male" ? "Macho" : "Hembra"}
                </span>
              </p>
            )}
            {patient.weight != null && (
              <p className="text-muted-foreground">
                Peso: <span className="font-medium text-foreground">{patient.weight} kg</span>
              </p>
            )}
            {patient.birth_date && (
              <p className="text-muted-foreground">
                Nac.:{" "}
                <span className="font-medium text-foreground">
                  {new Date(patient.birth_date).toLocaleDateString("es")}
                </span>
              </p>
            )}
            </div>
          </div>
        </div>

        {(patient.allergies || patient.chronic_conditions || patient.temperament_notes) && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {patient.allergies && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Alergias</p>
                <p className="mt-0.5">{patient.allergies}</p>
              </div>
            )}
            {patient.chronic_conditions && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Condiciones crónicas
                </p>
                <p className="mt-0.5">{patient.chronic_conditions}</p>
              </div>
            )}
            {patient.temperament_notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Temperamento</p>
                <p className="mt-0.5">{patient.temperament_notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Próximas dosis */}
      <UpcomingDosesPanel
        patientId={patientId}
        ownerId={patient.owner_id}
        vaccinations={vaccinations}
        dewormings={dewormings}
      />

      {/* Antecedentes */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-semibold">Antecedentes</h2>
            <p className="text-xs text-muted-foreground">
              Vacunas, desparasitaciones y cirugías previas (de carnet u otras clínicas).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setVaccinationOpen(true)}>
              <Syringe className="h-3.5 w-3.5" />+ Vacuna
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDewormingOpen(true)}>
              <Bug className="h-3.5 w-3.5" />+ Desparasitación
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSurgeryOpen(true)}>
              <Scissors className="h-3.5 w-3.5" />+ Cirugía
            </Button>
          </div>
        </div>

        {standaloneVacc.length === 0 && standaloneDew.length === 0 && standaloneSurg.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Sin antecedentes cargados.
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            {standaloneVacc.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Syringe className="h-3.5 w-3.5" /> Vacunas
                </p>
                <ul className="space-y-1">
                  {standaloneVacc.map((v) => (
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
                        {v.next_dose_at &&
                          ` · próxima: ${new Date(v.next_dose_at).toLocaleDateString("es")}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {standaloneDew.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Bug className="h-3.5 w-3.5" /> Desparasitaciones
                </p>
                <ul className="space-y-1">
                  {standaloneDew.map((d) => (
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
                          (
                          {d.treatment_type === "internal"
                            ? "interna"
                            : d.treatment_type === "external"
                            ? "externa"
                            : "ambas"}
                          )
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(d.applied_at).toLocaleDateString("es")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {standaloneSurg.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Scissors className="h-3.5 w-3.5" /> Cirugías
                </p>
                <ul className="space-y-1">
                  {standaloneSurg.map((s) => (
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
                      {s.description && (
                        <p className="text-muted-foreground mt-0.5">{s.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <VaccinationDialog
        open={vaccinationOpen}
        onClose={() => setVaccinationOpen(false)}
        patientId={patientId}
        patientName={patient.name}
        speciesId={patient.species_id ?? null}
      />
      <DewormingDialog
        open={dewormingOpen}
        onClose={() => setDewormingOpen(false)}
        patientId={patientId}
        patientName={patient.name}
      />
      <SurgeryDialog
        open={surgeryOpen}
        onClose={() => setSurgeryOpen(false)}
        patientId={patientId}
        patientName={patient.name}
      />
    </div>
  )
}
