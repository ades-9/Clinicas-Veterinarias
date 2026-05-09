import { useMutation, useQueryClient } from "@tanstack/react-query"
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
  treatment_type: string
  applied_at: string
  next_dose_at: string
  weight_at_application: string
  batch_number: string
  notes: string
}

const EMPTY: DewormingForm = {
  product_name: "",
  treatment_type: "internal",
  applied_at: new Date().toISOString().slice(0, 10),
  next_dose_at: "",
  weight_at_application: "",
  batch_number: "",
  notes: "",
}

interface Props {
  open: boolean
  onClose: () => void
  patientId: string
  patientName?: string
  /** Si se provee, la desparasitación queda atada a esa consulta. */
  recordId?: string
}

export function DewormingDialog({ open, onClose, patientId, patientName, recordId }: Props) {
  const api = useApiClient()
  const qc = useQueryClient()
  const [form, setForm] = useState<DewormingForm>(EMPTY)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setForm(EMPTY)
      setError("")
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: (data: object) =>
      recordId
        ? api.post<Deworming>(`/medical-records/${recordId}/dewormings`, data)
        : api.post<Deworming>(`/patients/${patientId}/dewormings`, data),
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
    mutation.mutate({
      product_name: form.product_name,
      treatment_type: form.treatment_type,
      applied_at: form.applied_at,
      next_dose_at: form.next_dose_at || null,
      weight_at_application: form.weight_at_application
        ? parseFloat(form.weight_at_application)
        : null,
      batch_number: form.batch_number || null,
      notes: form.notes || null,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={patientName ? `Nueva desparasitación — ${patientName}` : "Nueva desparasitación"}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="space-y-1.5">
          <Label htmlFor="d_batch">Número de lote</Label>
          <Input
            id="d_batch"
            value={form.batch_number}
            onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
          />
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
