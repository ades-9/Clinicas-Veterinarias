import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useApiClient } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Surgery } from "@/types"

interface SurgeryForm {
  name: string
  performed_at: string
  veterinarian_name: string
  description: string
  complications: string
}

const EMPTY: SurgeryForm = {
  name: "",
  performed_at: new Date().toISOString().slice(0, 10),
  veterinarian_name: "",
  description: "",
  complications: "",
}

interface Props {
  open: boolean
  onClose: () => void
  patientId: string
  patientName?: string
  /** Si se provee, la cirugía queda atada a esa consulta. */
  recordId?: string
}

export function SurgeryDialog({ open, onClose, patientId, patientName, recordId }: Props) {
  const api = useApiClient()
  const qc = useQueryClient()
  const [form, setForm] = useState<SurgeryForm>(EMPTY)
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
        ? api.post<Surgery>(`/medical-records/${recordId}/surgeries`, data)
        : api.post<Surgery>(`/patients/${patientId}/surgeries`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient-surgeries", patientId] })
      qc.invalidateQueries({ queryKey: ["medical-records", patientId] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    mutation.mutate({
      name: form.name,
      performed_at: form.performed_at,
      veterinarian_name: form.veterinarian_name || null,
      description: form.description || null,
      complications: form.complications || null,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={patientName ? `Nueva cirugía — ${patientName}` : "Nueva cirugía"}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="s_name">Nombre de la cirugía *</Label>
          <Input
            id="s_name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej. Esterilización, extracción dental..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="s_date">Fecha *</Label>
            <Input
              id="s_date"
              type="date"
              required
              value={form.performed_at}
              onChange={(e) => setForm({ ...form, performed_at: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s_vet">Veterinario que realizó</Label>
            <Input
              id="s_vet"
              value={form.veterinarian_name}
              onChange={(e) => setForm({ ...form, veterinarian_name: e.target.value })}
              placeholder="Nombre completo"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="s_desc">Descripción</Label>
          <Textarea
            id="s_desc"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Detalle del procedimiento, hallazgos, anestesia utilizada..."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="s_complications">Complicaciones</Label>
          <Textarea
            id="s_complications"
            rows={2}
            value={form.complications}
            onChange={(e) => setForm({ ...form, complications: e.target.value })}
            placeholder="Si las hubo durante o después de la cirugía"
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
