import { ChevronLeft, ChevronRight, PlayCircle, Pencil, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Appointment, AppointmentStatus } from "@/types"

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

const STATUS_VARIANT: Record<AppointmentStatus, "warning" | "default" | "success" | "destructive"> = {
  pending: "warning",
  confirmed: "default",
  attended: "success",
  cancelled: "destructive",
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  attended: "Atendida",
  cancelled: "Cancelada",
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  appointments: Appointment[]
  isLoading: boolean
  weekStart: Date
  onPrevWeek: () => void
  onNextWeek: () => void
  onStartConsultation: (appt: Appointment) => void
  onEdit: (appt: Appointment) => void
  onCancel: (appt: Appointment) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AppointmentCalendar({
  appointments,
  isLoading,
  weekStart,
  onPrevWeek,
  onNextWeek,
  onStartConsultation,
  onEdit,
  onCancel,
}: Props) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const weekEndLabel = addDays(weekStart, 6).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })
  const weekStartLabel = weekStart.toLocaleDateString("es", { day: "numeric", month: "long" })

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrevWeek}
          className="rounded-md p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium capitalize">
          {weekStartLabel} — {weekEndLabel}
        </span>
        <button
          onClick={onNextWeek}
          className="rounded-md p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[700px]">
          {/* Day headers */}
          {days.map((day, i) => {
            const isToday = sameDay(day, today)
            return (
              <div
                key={i}
                className={`px-2 py-2.5 text-center border-b ${i < 6 ? "border-r" : ""} ${isToday ? "bg-primary/5" : ""}`}
              >
                <p className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {DAY_LABELS[i]}
                </p>
                <p className={`text-sm font-semibold mt-0.5 ${isToday ? "text-primary" : ""}`}>
                  {day.getDate()}
                </p>
              </div>
            )
          })}

          {/* Day columns */}
          {days.map((day, i) => {
            const dayAppts = appointments
              .filter((a) => sameDay(new Date(a.scheduled_at), day) && a.status !== "cancelled")
              .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
            const isToday = sameDay(day, today)

            return (
              <div
                key={i}
                className={`${i < 6 ? "border-r" : ""} ${isToday ? "bg-primary/5" : ""} min-h-[120px] p-1.5 space-y-1.5`}
              >
                {isLoading ? (
                  <div className="h-6 rounded bg-muted/60 animate-pulse" />
                ) : dayAppts.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 text-center pt-3">—</p>
                ) : (
                  dayAppts.map((appt) => (
                    <ApptBlock
                      key={appt.id}
                      appt={appt}
                      onStartConsultation={onStartConsultation}
                      onEdit={onEdit}
                      onCancel={onCancel}
                    />
                  ))
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Appointment block ─────────────────────────────────────────────────────────

function ApptBlock({
  appt,
  onStartConsultation,
  onEdit,
  onCancel,
}: {
  appt: Appointment
  onStartConsultation: (a: Appointment) => void
  onEdit: (a: Appointment) => void
  onCancel: (a: Appointment) => void
}) {
  const time = new Date(appt.scheduled_at).toLocaleTimeString("es", { timeStyle: "short" })

  return (
    <div
      className={`group rounded-md border bg-background p-1.5 text-xs hover:shadow-sm transition-shadow ${
        appt.is_emergency ? "border-destructive bg-destructive/5" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-muted-foreground font-medium">{time}</span>
        {appt.is_emergency ? (
          <Badge variant="destructive" className="text-[10px] px-1 py-0">
            🚨 EMERG
          </Badge>
        ) : (
          <Badge variant={STATUS_VARIANT[appt.status]} className="text-[10px] px-1 py-0">
            {STATUS_LABELS[appt.status]}
          </Badge>
        )}
      </div>
      <p className="font-medium truncate">{appt.patient_name}</p>
      <p className="text-muted-foreground truncate">{appt.services.map((s) => s.name).join(" + ")}</p>

      {/* Actions — visible on hover */}
      <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {(appt.status === "pending" || appt.status === "confirmed") && (
          <button
            onClick={() => onStartConsultation(appt)}
            className="rounded p-0.5 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
            title="Iniciar atención"
          >
            <PlayCircle className="h-3.5 w-3.5" />
          </button>
        )}
        {appt.status !== "attended" && (
          <button
            onClick={() => onEdit(appt)}
            className="rounded p-0.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => onCancel(appt)}
          className="rounded p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Cancelar"
        >
          <XCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export { getWeekStart, addDays }
