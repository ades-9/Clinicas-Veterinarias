import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useApiClient } from "@/api/client"
import { AssigneeCombobox } from "@/components/AssigneeCombobox"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import type { Appointment, AppointmentService, User } from "@/types"

interface Props {
  open: boolean
  onClose: () => void
  patientId: string
  patientName: string
  ownerId: string
}

export function ScheduleSurgeryDialog({
  open,
  onClose,
  patientId,
  patientName,
  ownerId,
}: Props) {
  const api = useApiClient()
  const qc = useQueryClient()
  const { showSuccess } = useToast()
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [assignee, setAssignee] = useState<User | null>(null)
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      // Default: dentro de 7 días a las 9:00
      const d = new Date()
      d.setDate(d.getDate() + 7)
      setDate(d.toLocaleDateString("en-CA"))
      setTime("09:00")
      setServiceIds([])
      setAssignee(null)
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

  // Solo servicios del área veterinaria (las cirugías son médicas)
  const vetServices = services.filter((s) => s.service_type === "veterinary")

  const mutation = useMutation({
    mutationFn: (data: object) => api.post<Appointment>("/appointments", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] })
      qc.invalidateQueries({ queryKey: ["appointments-day"] })
      qc.invalidateQueries({ queryKey: ["appointments-calendar"] })
      qc.invalidateQueries({ queryKey: ["appointments-upcoming"] })
      onClose()
      showSuccess("Cirugía programada")
    },
    onError: (e: Error) => setError(e.message),
  })

  function toggleService(id: string) {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (serviceIds.length === 0) {
      setError("Selecciona al menos un servicio")
      return
    }
    if (!assignee) {
      setError("Selecciona un profesional")
      return
    }
    if (!date || !time) {
      setError("Selecciona fecha y hora")
      return
    }
    mutation.mutate({
      patient_id: patientId,
      owner_id: ownerId,
      assigned_user_id: assignee.id,
      service_ids: serviceIds,
      scheduled_at: new Date(`${date}T${time}:00`).toISOString(),
      notes: notes || `Programada desde consulta de ${patientName}`,
    })
  }

  const totalDuration = vetServices
    .filter((s) => serviceIds.includes(s.id))
    .reduce((acc, s) => acc + s.duration_minutes, 0)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Programar cirugía — ${patientName}`}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Crea una cita futura del área veterinaria con los servicios quirúrgicos seleccionados.
        </p>

        <div className="space-y-1.5">
          <Label>Servicios * {totalDuration > 0 && `(${totalDuration} min total)`}</Label>
          <div className="rounded-md border divide-y max-h-40 overflow-y-auto">
            {vetServices.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No hay servicios veterinarios configurados
              </p>
            ) : (
              vetServices.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={serviceIds.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                  />
                  <span className="flex-1 text-sm">
                    {s.name}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({s.duration_minutes} min)
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Profesional *</Label>
          <AssigneeCombobox value={assignee} onChange={setAssignee} areaFilter="veterinary" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ss_date">Fecha *</Label>
            <Input
              id="ss_date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ss_time">Hora *</Label>
            <Input
              id="ss_time"
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ss_notes">Notas</Label>
          <Textarea
            id="ss_notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={`Programada desde consulta de ${patientName}`}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Programando..." : "Programar cirugía"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
