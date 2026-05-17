import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useApiClient } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import type { Patient } from "@/types"

interface QuickForm {
  weight: string
  sex: string
  is_sterilized: string
  microchip_number: string
  distinctive_marks: string
  allergies: string
  chronic_conditions: string
  temperament_notes: string
}

const EMPTY: QuickForm = {
  weight: "",
  sex: "",
  is_sterilized: "",
  microchip_number: "",
  distinctive_marks: "",
  allergies: "",
  chronic_conditions: "",
  temperament_notes: "",
}

interface Props {
  open: boolean
  onClose: () => void
  patientId: string
  patientName: string
}

export function PatientQuickEditDialog({ open, onClose, patientId, patientName }: Props) {
  const api = useApiClient()
  const qc = useQueryClient()
  const { showSuccess } = useToast()
  const [form, setForm] = useState<QuickForm>(EMPTY)
  const [error, setError] = useState("")

  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => api.get<Patient>(`/patients/${patientId}`),
    enabled: open,
  })

  useEffect(() => {
    if (open && patient) {
      setForm({
        weight: patient.weight?.toString() ?? "",
        sex: patient.sex ?? "",
        is_sterilized: patient.is_sterilized == null ? "" : String(patient.is_sterilized),
        microchip_number: patient.microchip_number ?? "",
        distinctive_marks: patient.distinctive_marks ?? "",
        allergies: patient.allergies ?? "",
        chronic_conditions: patient.chronic_conditions ?? "",
        temperament_notes: patient.temperament_notes ?? "",
      })
      setError("")
    }
  }, [open, patient])

  const mutation = useMutation({
    mutationFn: (data: object) => api.patch<Patient>(`/patients/${patientId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", patientId] })
      qc.invalidateQueries({ queryKey: ["patients"] })
      onClose()
      showSuccess("Mascota actualizada")
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    mutation.mutate({
      weight: form.weight ? parseFloat(form.weight) : null,
      sex: form.sex || null,
      is_sterilized: form.is_sterilized === "" ? null : form.is_sterilized === "true",
      microchip_number: form.microchip_number || null,
      distinctive_marks: form.distinctive_marks || null,
      allergies: form.allergies || null,
      chronic_conditions: form.chronic_conditions || null,
      temperament_notes: form.temperament_notes || null,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Editar mascota — ${patientName}`}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Actualizá lo que el dueño recuerde durante la consulta. Otros campos se editan en la
          página de Mascotas.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="qp_sex" className="text-xs">Sexo</Label>
            <Select
              id="qp_sex"
              value={form.sex}
              onChange={(e) => setForm({ ...form, sex: e.target.value })}
            >
              <option value="">—</option>
              <option value="male">Macho</option>
              <option value="female">Hembra</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qp_ster" className="text-xs">Esterilizado</Label>
            <Select
              id="qp_ster"
              value={form.is_sterilized}
              onChange={(e) => setForm({ ...form, is_sterilized: e.target.value })}
            >
              <option value="">Desconocido</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qp_weight" className="text-xs">Peso (kg)</Label>
            <Input
              id="qp_weight"
              type="number"
              step="0.01"
              min="0"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qp_chip" className="text-xs">Microchip</Label>
          <Input
            id="qp_chip"
            value={form.microchip_number}
            onChange={(e) => setForm({ ...form, microchip_number: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qp_marks" className="text-xs">Marcas distintivas</Label>
          <Textarea
            id="qp_marks"
            rows={2}
            value={form.distinctive_marks}
            onChange={(e) => setForm({ ...form, distinctive_marks: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qp_allergies" className="text-xs">Alergias / intolerancias</Label>
          <Textarea
            id="qp_allergies"
            rows={2}
            value={form.allergies}
            onChange={(e) => setForm({ ...form, allergies: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qp_chronic" className="text-xs">Enfermedades crónicas</Label>
          <Textarea
            id="qp_chronic"
            rows={2}
            value={form.chronic_conditions}
            onChange={(e) => setForm({ ...form, chronic_conditions: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qp_temp" className="text-xs">Temperamento</Label>
          <Textarea
            id="qp_temp"
            rows={2}
            value={form.temperament_notes}
            onChange={(e) => setForm({ ...form, temperament_notes: e.target.value })}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
