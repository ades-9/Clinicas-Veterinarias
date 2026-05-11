import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Camera, X as XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useApiClient } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Deworming } from "@/types"

interface DewormingForm {
  product_name: string
  manufacturer: string
  treatment_type: string
  applied_at: string
  next_dose_at: string
  weight_at_application: string
  batch_number: string
  expiration_date: string
  notes: string
  applied_externally: boolean
  external_clinic_name: string
}

const EMPTY: DewormingForm = {
  product_name: "",
  manufacturer: "",
  treatment_type: "internal",
  applied_at: new Date().toISOString().slice(0, 10),
  next_dose_at: "",
  weight_at_application: "",
  batch_number: "",
  expiration_date: "",
  notes: "",
  applied_externally: false,
  external_clinic_name: "",
}

export interface DewormingDraftPayload {
  product_name: string
  manufacturer: string | null
  treatment_type: string
  applied_at: string
  next_dose_at: string | null
  weight_at_application: number | null
  batch_number: string | null
  expiration_date: string | null
  notes: string | null
  applied_externally: boolean
  external_clinic_name: string | null
  photoFile: File | null
}

interface Props {
  open: boolean
  onClose: () => void
  patientId: string
  patientName?: string
  /** Si se provee, la desparasitación queda atada a esa consulta. */
  recordId?: string
  /** Si se provee, NO postea: devuelve el draft al padre para que lo acumule. */
  onSubmitDraft?: (draft: DewormingDraftPayload) => void
}

export function DewormingDialog({
  open,
  onClose,
  patientId,
  patientName,
  recordId,
  onSubmitDraft,
}: Props) {
  const api = useApiClient()
  const qc = useQueryClient()
  const [form, setForm] = useState<DewormingForm>(EMPTY)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setForm(EMPTY)
      setPhotoFile(null)
      setError("")
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: async (data: object) => {
      const deworming = recordId
        ? await api.post<Deworming>(`/medical-records/${recordId}/dewormings`, data)
        : await api.post<Deworming>(`/patients/${patientId}/dewormings`, data)
      if (photoFile) {
        const formData = new FormData()
        formData.append("file", photoFile)
        await api.upload<{ photo_url: string }>(
          `/medical-records/dewormings/${deworming.id}/photo`,
          formData
        )
      }
      return deworming
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient-dewormings", patientId] })
      qc.invalidateQueries({ queryKey: ["medical-records", patientId] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const payload = {
      product_name: form.product_name,
      manufacturer: form.manufacturer || null,
      treatment_type: form.treatment_type,
      applied_at: form.applied_at,
      next_dose_at: form.next_dose_at || null,
      weight_at_application: form.weight_at_application
        ? parseFloat(form.weight_at_application)
        : null,
      batch_number: form.batch_number || null,
      expiration_date: form.expiration_date || null,
      notes: form.notes || null,
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
      title={patientName ? `Nueva desparasitación — ${patientName}` : "Nueva desparasitación"}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="d_product">Producto / medicamento *</Label>
            <Input
              id="d_product"
              required
              value={form.product_name}
              onChange={(e) => setForm({ ...form, product_name: e.target.value })}
              placeholder="Ej. Drontal Plus, Bravecto..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d_manufacturer">Marca / laboratorio</Label>
            <Input
              id="d_manufacturer"
              value={form.manufacturer}
              onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
              placeholder="Ej. Bayer, MSD..."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="d_type">Tipo *</Label>
            <Select
              id="d_type"
              required
              value={form.treatment_type}
              onChange={(e) => setForm({ ...form, treatment_type: e.target.value })}
            >
              <option value="internal">Interna</option>
              <option value="external">Externa</option>
              <option value="both">Ambas</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d_applied">Fecha *</Label>
            <Input
              id="d_applied"
              type="date"
              required
              value={form.applied_at}
              onChange={(e) => setForm({ ...form, applied_at: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="d_next">Próxima dosis</Label>
            <Input
              id="d_next"
              type="date"
              value={form.next_dose_at}
              onChange={(e) => setForm({ ...form, next_dose_at: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d_weight">Peso al aplicar (kg)</Label>
            <Input
              id="d_weight"
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
            <Label htmlFor="d_batch">Número de lote</Label>
            <Input
              id="d_batch"
              value={form.batch_number}
              onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d_expiration">Fecha de vencimiento</Label>
            <Input
              id="d_expiration"
              type="date"
              value={form.expiration_date}
              onChange={(e) => setForm({ ...form, expiration_date: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d_photo" className="flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5 text-muted-foreground" />
            Foto de la etiqueta
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
              id="d_photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d_notes">Notas</Label>
          <Textarea
            id="d_notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
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
