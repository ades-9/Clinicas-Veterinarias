import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, Bug, Calendar, Check, MessageCircle, Phone, Syringe } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useApiClient } from "@/api/client"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import type { UpcomingReminder } from "@/types"

function ContactBadge({ r }: { r: UpcomingReminder }) {
  const pref = r.owner_preferred_contact
  if (!pref) {
    return r.owner_phone ? (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Phone className="h-3 w-3" /> {r.owner_phone}
      </span>
    ) : null
  }
  const label =
    pref === "whatsapp" ? "WhatsApp" :
    pref === "sms" ? "SMS" :
    pref === "email" ? "Email" : "Llamada"
  const value =
    pref === "email" ? r.owner_email :
    r.owner_phone
  const Icon = pref === "email" ? MessageCircle : Phone
  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      <Icon className="h-3 w-3" />
      <span className="font-medium">{label}:</span> {value || "—"}
    </span>
  )
}

function statusBadge(days: number, lastReminded: string | null) {
  const reminded = lastReminded
    ? Math.floor((Date.now() - new Date(lastReminded).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const recently = reminded !== null && reminded < 7

  if (recently) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium">
        <Check className="h-3 w-3" /> Contactado hace {reminded}d
      </span>
    )
  }
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-semibold">
        <AlertCircle className="h-3 w-3" /> Vencida hace {Math.abs(days)}d
      </span>
    )
  }
  if (days <= 7) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
        {days === 0 ? "Hoy" : `En ${days}d`}
      </span>
    )
  }
  return (
    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
      En {days}d
    </span>
  )
}

export function RemindersPanel() {
  const api = useApiClient()
  const qc = useQueryClient()
  const { showSuccess } = useToast()
  const navigate = useNavigate()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["reminders-upcoming"],
    queryFn: () => api.get<UpcomingReminder[]>("/reminders/upcoming?days_ahead=30"),
  })

  const markReminded = useMutation({
    mutationFn: (data: object) => api.post<void>("/reminders/sent", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders-upcoming"] })
      showSuccess("Recordatorio marcado como enviado")
    },
  })

  function handleSchedule(r: UpcomingReminder) {
    const params = new URLSearchParams({
      new: "1",
      patient_id: r.patient_id,
      owner_id: r.owner_id,
      area: "veterinary",
      date: r.next_dose_at,
    })
    navigate(`/appointments?${params.toString()}`)
  }

  function handleMark(r: UpcomingReminder) {
    markReminded.mutate({
      patient_id: r.patient_id,
      type: r.kind === "vaccine" ? "vaccine_due" : "deworming_due",
      scheduled_at: r.next_dose_at,
    })
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-1">Recordatorios pendientes</h2>
        <p className="text-xs text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-1">Recordatorios pendientes</h2>
        <p className="text-xs text-muted-foreground">
          No hay vacunas ni desparasitaciones próximas en los siguientes 30 días.
        </p>
      </div>
    )
  }

  // Ordenar: vencidos primero, después por proximidad
  const sorted = [...items].sort((a, b) => a.days_from_today - b.days_from_today)
  const overdue = sorted.filter((r) => r.days_from_today < 0).length

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Recordatorios pendientes</h2>
          {overdue > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-semibold">
              {overdue} vencido{overdue > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Próximas vacunas y desparasitaciones de los siguientes 30 días.
        </p>
      </div>

      <ul className="space-y-2">
        {sorted.map((r, idx) => (
          <li
            key={`${r.kind}-${r.patient_id}-${r.label}-${idx}`}
            className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm"
          >
            {r.kind === "vaccine" ? (
              <Syringe className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <Bug className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                <button
                  onClick={() => navigate(`/patients/${r.patient_id}`)}
                  className="hover:underline"
                >
                  {r.patient_name}
                </button>
                <span className="text-muted-foreground"> · {r.owner_name}</span>
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {r.label}
                {r.manufacturer && ` · ${r.manufacturer}`}
              </p>
              <ContactBadge r={r} />
            </div>
            <div className="text-right text-xs">
              <p className="text-muted-foreground">
                {new Date(r.next_dose_at).toLocaleDateString("es", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </p>
              <div className="mt-0.5">{statusBadge(r.days_from_today, r.last_reminded_at)}</div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <Button size="sm" variant="outline" onClick={() => handleSchedule(r)}>
                <Calendar className="h-3.5 w-3.5" />
                Agendar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleMark(r)}
                disabled={markReminded.isPending}
                title="Registrar que ya se contactó al dueño"
              >
                <Check className="h-3.5 w-3.5" />
                Contactado
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
