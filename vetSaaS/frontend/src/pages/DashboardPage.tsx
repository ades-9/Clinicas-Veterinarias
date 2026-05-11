import { useUser } from "@clerk/clerk-react"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, Calendar, CheckCircle2, Clock, PawPrint } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useApiClient } from "@/api/client"
import { EmergencyDialog } from "@/components/EmergencyDialog"
import { RemindersPanel } from "@/components/RemindersPanel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Appointment, AppointmentStatus } from "@/types"

// ── Helpers de fecha ──────────────────────────────────────────────────────────

function toISOLocal(date: Date) {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { from: toISOLocal(start), to: toISOLocal(end) }
}

function upcomingRange() {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setDate(end.getDate() + 7)
  end.setHours(23, 59, 59, 999)
  return { from: toISOLocal(start), to: toISOLocal(end) }
}

// ── Status badges ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  attended: "Atendida",
  cancelled: "Cancelada",
}

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "secondary" | "outline"

const STATUS_VARIANT: Record<AppointmentStatus, BadgeVariant> = {
  pending: "warning",
  confirmed: "default",
  attended: "success",
  cancelled: "destructive",
}

// ── Componentes de tarjeta stat ───────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number
  icon: React.ReactNode
  sub?: string
}

function StatCard({ label, value, icon, sub }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card p-5 flex items-center gap-4">
      <div className="rounded-md bg-primary/10 p-2.5 text-primary shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

// ── Fila de cita ─────────────────────────────────────────────────────────────

function ApptRow({ appt }: { appt: Appointment }) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 text-muted-foreground text-sm">
        {new Date(appt.scheduled_at).toLocaleTimeString("es", { timeStyle: "short" })}
      </td>
      <td className="px-4 py-3 font-medium text-sm">{appt.patient_name}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{appt.owner_name}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{appt.services.map((s) => s.name).join(" + ")}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{appt.assigned_user_name}</td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_VARIANT[appt.status]}>{STATUS_LABELS[appt.status]}</Badge>
      </td>
    </tr>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useUser()
  const api = useApiClient()
  const navigate = useNavigate()
  const [emergencyOpen, setEmergencyOpen] = useState(false)

  const today = todayRange()
  const upcoming = upcomingRange()
  const todayStr = new Date().toLocaleDateString("en-CA")

  const { data: todayAppts = [], isLoading: loadingToday } = useQuery({
    queryKey: ["appointments-today", todayStr],
    queryFn: () =>
      api.get<Appointment[]>(
        `/appointments?date_from=${encodeURIComponent(today.from)}&date_to=${encodeURIComponent(today.to)}&limit=100`
      ),
    staleTime: 0,
  })

  const { data: upcomingAppts = [], isLoading: loadingUpcoming } = useQuery({
    queryKey: ["appointments-upcoming", todayStr],
    queryFn: () =>
      api.get<Appointment[]>(
        `/appointments?date_from=${encodeURIComponent(upcoming.from)}&date_to=${encodeURIComponent(upcoming.to)}&limit=100`
      ),
    staleTime: 0,
  })

  const pending = todayAppts.filter((a) => a.status === "pending").length
  const confirmed = todayAppts.filter((a) => a.status === "confirmed").length
  const attended = todayAppts.filter((a) => a.status === "attended").length

  const todaySorted = [...todayAppts].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  )

  const upcomingSorted = [...upcomingAppts]
    .filter((a) => a.status !== "cancelled")
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 8)

  const todayLabel = new Date().toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold capitalize">
            Hola, {user?.firstName ?? "usuario"} 👋
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{todayLabel}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={() => setEmergencyOpen(true)}>
            <AlertCircle className="h-4 w-4" />
            Emergencia
          </Button>
          <Button onClick={() => navigate("/appointments")}>
            <Calendar className="h-4 w-4" />
            Nueva cita
          </Button>
        </div>
      </div>

      {/* Recordatorios pendientes */}
      <RemindersPanel />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Citas hoy"
          value={todayAppts.length}
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatCard
          label="Pendientes"
          value={pending}
          icon={<Clock className="h-5 w-5" />}
          sub="de hoy"
        />
        <StatCard
          label="Confirmadas"
          value={confirmed}
          icon={<CheckCircle2 className="h-5 w-5" />}
          sub="de hoy"
        />
        <StatCard
          label="Próximos 7 días"
          value={upcomingAppts.filter((a) => a.status !== "cancelled").length}
          icon={<PawPrint className="h-5 w-5" />}
          sub="citas agendadas"
        />
      </div>

      {/* Citas de hoy */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <h2 className="font-semibold text-sm">Citas de hoy</h2>
          {attended > 0 && (
            <span className="text-xs text-muted-foreground">
              {attended} atendida{attended !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {loadingToday ? (
          <p className="px-4 py-8 text-sm text-center text-muted-foreground">Cargando...</p>
        ) : todaySorted.length === 0 ? (
          <p className="px-4 py-8 text-sm text-center text-muted-foreground">
            No hay citas programadas para hoy
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/20">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Hora</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Mascota</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Propietario</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Servicio</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Asignado</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Estado</th>
              </tr>
            </thead>
            <tbody>
              {todaySorted.map((appt) => (
                <ApptRow key={appt.id} appt={appt} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Próximas citas (7 días) */}
      {(loadingUpcoming || upcomingSorted.length > 0) && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h2 className="font-semibold text-sm">Próximas citas (7 días)</h2>
          </div>
          {loadingUpcoming ? (
            <p className="px-4 py-8 text-sm text-center text-muted-foreground">Cargando...</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/20">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Fecha</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Hora</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Mascota</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Servicio</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Asignado</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Estado</th>
                </tr>
              </thead>
              <tbody>
                {upcomingSorted.map((appt) => (
                  <tr
                    key={appt.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-muted-foreground text-sm capitalize">
                      {new Date(appt.scheduled_at).toLocaleDateString("es", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">
                      {new Date(appt.scheduled_at).toLocaleTimeString("es", {
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-sm">{appt.patient_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{appt.services.map((s) => s.name).join(" + ")}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {appt.assigned_user_name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[appt.status]}>
                        {STATUS_LABELS[appt.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <EmergencyDialog open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
    </div>
  )
}
