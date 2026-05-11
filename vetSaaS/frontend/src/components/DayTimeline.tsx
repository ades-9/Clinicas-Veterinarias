import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Appointment, AppointmentService } from "@/types"

const HOUR_HEIGHT = 64
const START_HOUR = 8
const END_HOUR = 20
const COMPACT_THRESHOLD_PX = 30  // bajo esto, mostramos una sola línea compacta
const TOTAL_HOURS = END_HOUR - START_HOUR
const LEFT_GUTTER_PX = 56
const RIGHT_PAD_PX = 8
const COL_GAP_PX = 2

interface BlockPos {
  top: number
  height: number
  visible: boolean
}

function getBlockPosition(startMinutesInDay: number, durationMinutes: number): BlockPos {
  const startVisible = START_HOUR * 60
  const endVisible = END_HOUR * 60
  const blockStart = Math.max(startMinutesInDay, startVisible)
  const blockEnd = Math.min(startMinutesInDay + durationMinutes, endVisible)

  if (blockEnd <= startVisible || blockStart >= endVisible || blockEnd <= blockStart) {
    return { top: 0, height: 0, visible: false }
  }
  return {
    top: ((blockStart - startVisible) / 60) * HOUR_HEIGHT,
    height: ((blockEnd - blockStart) / 60) * HOUR_HEIGHT,
    visible: true,
  }
}

function minutesInDay(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

function formatHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// ── Layout: asigna columnas a cada bloque dentro de su cluster de overlaps ────

interface RawBlock {
  key: string
  startMin: number
  endMin: number
  isNew: boolean
  isConflict: boolean
  appt?: Appointment
}

interface PositionedBlock extends RawBlock {
  col: number
  cols: number
}

function layoutBlocks(blocks: RawBlock[]): PositionedBlock[] {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const result: PositionedBlock[] = []
  let cluster: (RawBlock & { col: number })[] = []
  let clusterMaxEnd = -Infinity

  const flush = () => {
    if (cluster.length === 0) return
    const cols = Math.max(...cluster.map((c) => c.col)) + 1
    for (const c of cluster) result.push({ ...c, cols })
    cluster = []
    clusterMaxEnd = -Infinity
  }

  for (const b of sorted) {
    if (b.startMin >= clusterMaxEnd) flush()
    // Buscar primera columna libre (donde el último bloque ya terminó)
    const usedCols = new Set(
      cluster.filter((c) => c.endMin > b.startMin).map((c) => c.col)
    )
    let col = 0
    while (usedCols.has(col)) col++
    cluster.push({ ...b, col })
    clusterMaxEnd = Math.max(clusterMaxEnd, b.endMin)
  }
  flush()
  return result
}

interface Props {
  date: Date
  onPrevDay?: () => void
  onNextDay?: () => void
  newStartISO: string | null
  newDurationMinutes: number | null
  existingAppointments: Appointment[]
  services: AppointmentService[]
  excludeAppointmentId?: string
  /** IDs de los servicios de la nueva cita; se marca conflicto si una cita existente comparte alguno. */
  selectedServiceIds?: string[]
  selectedAssigneeId?: string | null
}

export function DayTimeline({
  date,
  onPrevDay,
  onNextDay,
  newStartISO,
  newDurationMinutes,
  existingAppointments,
  services,
  excludeAppointmentId,
  selectedServiceIds = [],
  selectedAssigneeId,
}: Props) {
  const dateKey = date.toLocaleDateString("en-CA")
  // services prop ya no se usa para resolver duraciones (ahora viene en a.total_duration_minutes),
  // pero se mantiene por compatibilidad de prop con el caller.
  void services

  const dayAppts = existingAppointments.filter((a) => {
    if (a.id === excludeAppointmentId) return false
    if (a.status === "cancelled") return false
    return new Date(a.scheduled_at).toLocaleDateString("en-CA") === dateKey
  })

  // Bloque candidato (nueva cita)
  const newBlock = (() => {
    if (!newStartISO || !newDurationMinutes) return null
    const startMin = minutesInDay(newStartISO)
    return { startMin, endMin: startMin + newDurationMinutes }
  })()

  // Construir lista cruda de bloques
  const rawBlocks: RawBlock[] = []
  for (const a of dayAppts) {
    const dur =
      a.total_duration_minutes ||
      a.services.reduce((acc, s) => acc + s.duration_minutes, 0) ||
      30
    const start = minutesInDay(a.scheduled_at)
    const end = start + dur
    const sharesService =
      selectedServiceIds.length > 0 &&
      a.services.some((s) => selectedServiceIds.includes(s.id))
    const isConflict =
      !!newBlock &&
      start < newBlock.endMin &&
      newBlock.startMin < end &&
      (sharesService || (!!selectedAssigneeId && a.assigned_user_id === selectedAssigneeId))
    rawBlocks.push({
      key: a.id,
      startMin: start,
      endMin: end,
      isNew: false,
      isConflict,
      appt: a,
    })
  }
  if (newBlock) {
    rawBlocks.push({
      key: "__new__",
      startMin: newBlock.startMin,
      endMin: newBlock.endMin,
      isNew: true,
      isConflict: false,
    })
  }

  const positioned = layoutBlocks(rawBlocks)

  return (
    <div className="flex flex-col h-full">
      {/* Header con fecha */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        {onPrevDay ? (
          <button
            type="button"
            onClick={onPrevDay}
            className="p-1 rounded hover:bg-accent text-muted-foreground"
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : (
          <span className="w-6" />
        )}
        <p className="text-sm font-medium capitalize">{formatDateLabel(date)}</p>
        {onNextDay ? (
          <button
            type="button"
            onClick={onNextDay}
            className="p-1 rounded hover:bg-accent text-muted-foreground"
            aria-label="Día siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <span className="w-6" />
        )}
      </div>

      {/* Timeline scrolleable */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="relative"
          style={{
            height: `${TOTAL_HOURS * HOUR_HEIGHT + 16}px`,
            paddingTop: "10px",
          }}
        >
          {/* Líneas horarias */}
          {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i + START_HOUR).map((h, i) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-border/40 flex items-start"
              style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }}
            >
              <span
                className={`text-xs text-muted-foreground pl-2 bg-background pr-1 ${
                  i === 0 ? "mt-0.5" : "-mt-2"
                }`}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}

          {/* Bloques */}
          {positioned.map((b) => {
            const pos = getBlockPosition(b.startMin, b.endMin - b.startMin)
            if (!pos.visible) return null

            const isCompact = pos.height < COMPACT_THRESHOLD_PX
            const padding = isCompact ? "px-2 py-0.5" : "px-2 py-1"

            // Estilos por tipo
            const isEmergency = b.appt?.is_emergency === true
            let className = `absolute rounded ${padding} overflow-hidden`
            if (b.isNew) {
              className += " bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40 z-10"
            } else if (isEmergency) {
              className += " bg-destructive/20 border-2 border-destructive text-destructive font-medium"
            } else if (b.isConflict) {
              className += " bg-destructive/15 border border-destructive text-destructive"
            } else {
              className += " bg-muted/70 border border-border text-foreground/70"
            }

            // Layout horizontal por columnas
            const left = `calc(${LEFT_GUTTER_PX}px + (100% - ${LEFT_GUTTER_PX + RIGHT_PAD_PX}px) * ${b.col} / ${b.cols})`
            const width = `calc((100% - ${LEFT_GUTTER_PX + RIGHT_PAD_PX}px) / ${b.cols} - ${COL_GAP_PX}px)`

            return (
              <div
                key={b.key}
                className={className}
                style={{
                  top: `${pos.top + 1}px`,
                  height: `${pos.height - 2}px`,
                  left,
                  width,
                }}
                title={
                  b.appt
                    ? `${b.appt.patient_name} · ${b.appt.services.map((s) => s.name).join(" + ")} · ${b.appt.assigned_user_name} · ${formatHHMM(b.startMin)}–${formatHHMM(b.endMin)}`
                    : `Nueva cita · ${formatHHMM(b.startMin)}–${formatHHMM(b.endMin)}`
                }
              >
                {isCompact ? (
                  <p className="text-[11px] font-medium leading-tight truncate">
                    {b.isNew
                      ? `${formatHHMM(b.startMin)}–${formatHHMM(b.endMin)} · Nueva`
                      : `${b.appt!.patient_name} · ${b.appt!.services.map((s) => s.name).join(" + ")}`}
                  </p>
                ) : b.isNew ? (
                  <>
                    <p className="text-xs font-semibold leading-tight truncate">
                      {formatHHMM(b.startMin)} – {formatHHMM(b.endMin)}
                    </p>
                    <p className="text-[11px] leading-tight opacity-90 truncate">Nueva cita</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium leading-tight truncate">
                      {b.appt!.patient_name}
                    </p>
                    <p className="text-[11px] leading-tight truncate opacity-75">
                      {b.appt!.services.map((s) => s.name).join(" + ")}
                    </p>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
