import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Camera, X as XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useApiClient } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import type { Vaccination, VaccineType } from "@/types"

interface VaccinationForm {
  vaccine_type_id: string
  vaccine_name: string
  manufacturer: string
  applied_at: string
  next_dose_at: string
  batch_number: string
  expiration_date: string
  weight_at_application: string
  applied_externally: boolean
  external_clinic_name: string
}

const EMPTY: VaccinationForm = {
  vaccine_type_id: "",
  vaccine_name: "",
  manufacturer: "",
  applied_at: new Date().toISOString().slice(0, 10),
  next_dose_at: "",
  batch_number: "",
  expiration_date: "",
  weight_at_application: "",
  applied_externally: false,
  external_clinic_name: "",
}

export interface VaccinationDraftPayload {
  vaccine_type_id: string | null
  vaccine_name: string
  manufacturer: string | null
  applied_at: string
  next_dose_at: string | null
  batch_number: string | null
  expiration_date: string | null
  weight_at_application: number | null
  applied_externally: boolean
  external_clinic_name: string | null
  photoFile: File | null
}

interface Props {
  open: boolean
  onClose: () => void
  patientId: string
  patientName?: string
  /** species_id de la mascota para filtrar el catálogo */
  speciesId?: string | null
  /** Si se provee, se ata a esa consulta. */
  recordId?: string
  /** Si se provee, NO postea: devuelve el draft al padre para que lo acumule. */
  onSubmitDraft?: (draft: VaccinationDraftPayload) => void
}

function addMonths(yyyymmdd: string, months: number): string {
  if (!yyyymmdd) return ""
  const d = new Date(yyyymmdd + "T00:00:00")
  d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString("en-CA")
}

export function VaccinationDialog({
  open,
  onClose,
  patientId,
  patientName,
  speciesId,
  recordId,
  onSubmitDraft,
}: Props) {
  const api = useApiClient()
  const qc = useQueryClient()
  const { showSuccess } = useToast()
  const [form, setForm] = useState<VaccinationForm>(EMPTY)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setForm(EMPTY)
      setPhotoFile(null)
      setError("")
    }
  }, [open])

  const { data: vaccineTypes = [] } = useQuery({
    queryKey: ["catalog-vaccine-types", speciesId],
    queryFn: () =>
      api.get<VaccineType[]>(
        `/catalog/vaccine-types${speciesId ? `?species_id=${speciesId}` : ""}`
      ),
    enabled: open,
    staleTime: Infinity,
  })

  // Cuando cambia el tipo de vacuna: precarga nombre y calcula próxima dosis
  function handleTypeChange(typeId: string) {
    const t = vaccineTypes.find((v) => v.id === typeId)
    setForm((f) => ({
      ...f,
      vaccine_type_id: typeId,
      vaccine_name: t?.name ?? f.vaccine_name,
      next_dose_at:
        t?.recommended_revaccination_months && f.applied_at
          ? addMonths(f.applied_at, t.recommended_revaccination_months)
          : f.next_dose_at,
    }))
  }

  // Recalcula próxima dosis si cambia la fecha de aplicación con un tipo seleccionado
  function handleAppliedAtChange(applied: string) {
    const t = vaccineTypes.find((v) => v.id === form.vaccine_type_id)
    setForm((f) => ({
      ...f,
      applied_at: applied,
      next_dose_at:
        t?.recommended_revaccination_months && applied
          ? addMonths(applied, t.recommended_revaccination_months)
          : f.next_dose_at,
    }))
  }

  const mutation = useMutation({
    mutationFn: async (data: object) => {
      const vacc = recordId
        ? await api.post<Vaccination>(`/medical-records/${recordId}/vaccinations`, data)
        : await api.post<Vaccination>(`/patients/${patientId}/vaccinations`, data)
      if (photoFile) {
        const formData = new FormData()
        formData.append("file", photoFile)
        await api.upload<{ photo_url: string }>(
          `/medical-records/vaccinations/${vacc.id}/photo`,
          formData
        )
      }
      return vacc
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient-vaccinations", patientId] })
      qc.invalidateQueries({ queryKey: ["medical-records", patientId] })
      onClose()
      showSuccess("Vacuna registrada")
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.vaccine_name.trim()) {
      setError("Indicá el nombre de la vacuna")
      return
    }
    const payload = {
      vaccine_type_id: form.vaccine_type_id || null,
      vaccine_name: form.vaccine_name,
      manufacturer: form.manufacturer || null,
      applied_at: form.applied_at,
      next_dose_at: form.next_dose_at || null,
      batch_number: form.batch_number || null,
      expiration_date: form.expiration_date || null,
      weight_at_application: form.weight_at_application
        ? parseFloat(form.weight_at_application)
        : null,
      applied_externally: form.applied_externally,
      external_clinic_name: form.applied_externally
        ? (form.external_clinic_name || null)
        : null,
    }
    if (onSubmitDraft) {
      onSubmitDraft({ ...payload, photoFile })
      onClose()
      return
    }
    mutation.mutate(payload)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={patientName ? `Nueva vacuna — ${patientName}` : "Nueva vacuna"}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="v_type">Tipo de vacuna</Label>
          <Select
            id="v_type"
            value={form.vaccine_type_id}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            <option value="">Otro / no listado</option>
            {vaccineTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.recommended_revaccination_months
                  ? ` · revac. cada ${t.recommended_revaccination_months}m`
                  : ""}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="v_name">Nombre comercial *</Label>
            <Input
              id="v_name"
              required
              value={form.vaccine_name}
              onChange={(e) => setForm({ ...form, vaccine_name: e.target.value })}
              placeholder="Ej. Vanguard Plus 5"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v_manufacturer">Marca / laboratorio</Label>
            <Input
              id="v_manufacturer"
              value={form.manufacturer}
              onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
              placeholder="Ej. Zoetis, MSD..."
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="v_applied">Aplicada *</Label>
            <Input
              id="v_applied"
              type="date"
              required
              value={form.applied_at}
              onChange={(e) => handleAppliedAtChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v_next">Próxima dosis</Label>
            <Input
              id="v_next"
              type="date"
              value={form.next_dose_at}
              onChange={(e) => setForm({ ...form, next_dose_at: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v_weight">Peso (kg)</Label>
            <Input
              id="v_weight"
              type="number"
              step="0.01"
              min="0"
              value={form.weight_at_application}
              onChange={(e) => setForm({ ...form, weight_at_application: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="v_batch">Número de lote</Label>
            <Input
              id="v_batch"
              value={form.batch_number}
              onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v_expiration">Vencimiento</Label>
            <Input
              id="v_expiration"
              type="date"
              value={form.expiration_date}
              onChange={(e) => setForm({ ...form, expiration_date: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="v_photo" className="flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5 text-muted-foreground" />
            Foto de la etiqueta del frasco
          </Label>
          {photoFile ? (
            <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm">
              <span className="flex-1 truncate">{photoFile.name}</span>
              <button
                type="button"
                onClick={() => setPhotoFile(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Quitar foto"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Input
              id="v_photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
          )}
        </div>

        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={form.applied_externally}
              onChange={(e) =>
                setForm({ ...form, applied_externally: e.target.checked })
              }
            />
            <span>Aplicada en otra clínica</span>
          </label>
          {form.applied_externally && (
            <Input
              placeholder="Nombre de la clínica (opcional)"
              value={form.external_clinic_name}
              onChange={(e) =>
                setForm({ ...form, external_clinic_name: e.target.value })
              }
            />
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
