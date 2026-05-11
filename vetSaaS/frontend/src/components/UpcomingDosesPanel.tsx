import { AlertCircle, Bug, Calendar, Syringe } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import type { Deworming, Vaccination } from "@/types"

interface UpcomingItem {
  key: string
  kind: "vaccine" | "deworming"
  label: string
  details: string
  nextDoseAt: Date
  daysFromToday: number
  patientId: string
  ownerId: string
}

interface Props {
  patientId: string
  ownerId: string
  vaccinations: Vaccination[]
  dewormings: Deworming[]
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export function UpcomingDosesPanel({ patientId, ownerId, vaccinations, dewormings }: Props) {
  const navigate = useNavigate()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // De-duplicar: para cada tipo (vaccine_type_id) o producto (product_name) quedarnos con
  // la última aplicación (la fecha next_dose_at más reciente proyectada).
  const latestVaccByKey = new Map<string, Vaccination>()
  for (const v of vaccinations) {
    if (!v.next_dose_at) continue
    const key = v.vaccine_type_id ?? `name:${v.vaccine_name}`
    const prev = latestVaccByKey.get(key)
    if (!prev || new Date(v.applied_at) > new Date(prev.applied_at)) {
      latestVaccByKey.set(key, v)
    }
  }

  const latestDewByKey = new Map<string, Deworming>()
  for (const d of dewormings) {
    if (!d.next_dose_at) continue
    const key = `${d.product_name}|${d.treatment_type}`
    const prev = latestDewByKey.get(key)
    if (!prev || new Date(d.applied_at) > new Date(prev.applied_at)) {
      latestDewByKey.set(key, d)
    }
  }

  const items: UpcomingItem[] = []
  for (const v of latestVaccByKey.values()) {
    const next = new Date(v.next_dose_at as string)
    items.push({
      key: `v-${v.id}`,
      kind: "vaccine",
      label: v.vaccine_name,
      details: [v.manufacturer, v.batch_number && `lote ${v.batch_number}`]
        .filter(Boolean)
        .join(" · "),
      nextDoseAt: next,
      daysFromToday: daysBetween(today, next),
      patientId,
      ownerId,
    })
  }
  for (const d of latestDewByKey.values()) {
    const next = new Date(d.next_dose_at as string)
    items.push({
      key: `d-${d.id}`,
      kind: "deworming",
      label: d.product_name,
      details:
        d.treatment_type === "internal"
          ? "interna"
          : d.treatment_type === "external"
          ? "externa"
          : "ambas",
      nextDoseAt: next,
      daysFromToday: daysBetween(today, next),
      patientId,
      ownerId,
    })
  }

  items.sort((a, b) => a.nextDoseAt.getTime() - b.nextDoseAt.getTime())

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-1">Próximas dosis</h2>
        <p className="text-xs text-muted-foreground">
          No hay vacunas ni desparasitaciones con próxima dosis programada.
        </p>
      </div>
    )
  }

  function handleSchedule(it: UpcomingItem) {
    const dateStr = it.nextDoseAt.toLocaleDateString("en-CA")
    const params = new URLSearchParams({
      new: "1",
      patient_id: it.patientId,
      owner_id: it.ownerId,
      area: "veterinary",
      date: dateStr,
    })
    navigate(`/appointments?${params.toString()}`)
  }

  function statusBadge(days: number) {
    if (days < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-medium">
          <AlertCircle className="h-3 w-3" /> Vencida hace {Math.abs(days)}d
        </span>
      )
    }
    if (days <= 30) {
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

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Próximas dosis</h2>
          <p className="text-xs text-muted-foreground">
            Vacunas y desparasitaciones con fecha de próxima dosis. Click en Agendar abre el modal
            de cita pre-llenado.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.key}
            className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm"
          >
            {it.kind === "vaccine" ? (
              <Syringe className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <Bug className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{it.label}</p>
              {it.details && (
                <p className="text-xs text-muted-foreground truncate">{it.details}</p>
              )}
            </div>
            <div className="text-right text-xs">
              <p className="text-muted-foreground">
                {it.nextDoseAt.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <div className="mt-0.5">{statusBadge(it.daysFromToday)}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleSchedule(it)}>
              <Calendar className="h-3.5 w-3.5" />
              Agendar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
