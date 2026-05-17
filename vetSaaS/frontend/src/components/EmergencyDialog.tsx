import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { useApiClient } from "@/api/client"
import { AssigneeCombobox } from "@/components/AssigneeCombobox"
import { OwnerCombobox } from "@/components/OwnerCombobox"
import { PatientCombobox } from "@/components/PatientCombobox"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type {
  Appointment,
  AppointmentService,
  Owner,
  Patient,
  ServiceType,
  User,
} from "@/types"

interface Props {
  open: boolean
  onClose: () => void
}

export function EmergencyDialog({ open, onClose }: Props) {
  const api = useApiClient()
  const qc = useQueryClient()

  const [owner, setOwner] = useState<Owner | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [assignee, setAssignee] = useState<User | null>(null)
  const [area, setArea] = useState<ServiceType>("veterinary")
  const [serviceId, setServiceId] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setOwner(null)
      setPatient(null)
      setAssignee(null)
      setArea("veterinary")
      setServiceId("")
      setNotes("")
      setError("")
    }
  }, [open])

  const { data: services = [] } = useQuery({
    queryKey: ["appointment-services"],
    queryFn: () => api.get<AppointmentService[]>("/appointment-services"),
    enabled: open,
    staleTime: 60_000,
  })

  const servicesInArea = services.filter((s) => s.service_type === area)

  const mutation = useMutation({
    mutationFn: (data: object) => api.post<Appointment>("/appointments", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] })
      qc.invalidateQueries({ queryKey: ["appointments-today"] })
      qc.invalidateQueries({ queryKey: ["appointments-upcoming"] })
      qc.invalidateQueries({ queryKey: ["appointments-calendar"] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleOwnerChange(o: Owner | null) {
    setOwner(o)
    setPatient(null)
  }

  function handleAreaChange(a: ServiceType) {
    setArea(a)
    setServiceId("")
    if (assignee && assignee.areas.length > 0 && !assignee.areas.includes(a)) {
      setAssignee(null)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!owner) { setError("Selecciona el propietario"); return }
    if (!patient) { setError("Selecciona la mascota"); return }
    if (!assignee) { setError("Selecciona el profesional"); return }
    if (!serviceId) { setError("Selecciona el servicio"); return }

    // scheduled_at = ahora, en UTC ISO (TIMESTAMPTZ en backend)
    mutation.mutate({
      patient_id: patient.id,
      owner_id: owner.id,
      assigned_user_id: assignee.id,
      service_ids: [serviceId],
      scheduled_at: new Date().toISOString(),
      notes: notes || "EMERGENCIA",
      is_emergency: true,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="🚨 Registrar emergencia"
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            La cita se crea con la fecha y hora actual. Salta la validación de conflictos y de
            fecha pasada. Quedará marcada como emergencia en el calendario.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Propietario *</Label>
          <OwnerCombobox value={owner} onChange={handleOwnerChange} />
        </div>

        <div className="space-y-1.5">
          <Label>Mascota *</Label>
          <PatientCombobox
            ownerId={owner?.id ?? null}
            value={patient}
            onChange={setPatient}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="e_area">Área *</Label>
            <select
              id="e_area"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
              value={area}
              onChange={(e) => handleAreaChange(e.target.value as ServiceType)}
            >
              <option value="veterinary">Veterinaria</option>
              <option value="grooming">Peluquería</option>
              <option value="aesthetic">Estética</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e_service">Servicio *</Label>
            <select
              id="e_service"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              <option value="">Seleccionar...</option>
              {servicesInArea.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Profesional *</Label>
          <AssigneeCombobox value={assignee} onChange={setAssignee} areaFilter={area} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="e_notes">Notas</Label>
          <Textarea
            id="e_notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Motivo, estado del animal, etc."
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="destructive" disabled={mutation.isPending}>
            {mutation.isPending ? "Registrando..." : "🚨 Registrar emergencia"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
