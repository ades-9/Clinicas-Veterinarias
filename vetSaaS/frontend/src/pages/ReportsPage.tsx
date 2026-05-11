import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useApiClient } from "@/api/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ProfessionalPerformanceReport } from "@/types"

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}

function firstDayOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA")
}

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA")
}

export function ReportsPage() {
  const api = useApiClient()
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth())
  const [dateTo, setDateTo] = useState(todayStr())

  const { data, isLoading, error } = useQuery({
    queryKey: ["report-professional-performance", dateFrom, dateTo],
    queryFn: () =>
      api.get<ProfessionalPerformanceReport>(
        `/reports/professional-performance?date_from=${dateFrom}&date_to=${dateTo}`
      ),
  })

  const professionals = data?.professionals ?? []

  // Totales globales
  const totals = professionals.reduce(
    (acc, p) => ({
      attended: acc.attended + p.appointments_attended,
      cancelled: acc.cancelled + p.appointments_cancelled,
      consultations: acc.consultations + p.consultations_count,
      services: acc.services + p.services_sold,
      products: acc.products + p.products_sold,
      revenue: acc.revenue + Number(p.revenue_total),
    }),
    { attended: 0, cancelled: 0, consultations: 0, services: 0, products: 0, revenue: 0 }
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Rendimiento por profesional. Las citas se cuentan por fecha programada; las ventas por
          fecha de la venta (debe estar cobrada).
        </p>
      </div>

      {/* Filtros */}
      <div className="rounded-lg border bg-card p-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="r_from">Desde</Label>
          <Input
            id="r_from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r_to">Hasta</Label>
          <Input
            id="r_to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="flex gap-2 ml-auto text-xs">
          <button
            onClick={() => { setDateFrom(firstDayOfMonth()); setDateTo(todayStr()) }}
            className="text-primary hover:underline"
          >
            Mes actual
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            onClick={() => {
              const d = new Date()
              d.setDate(d.getDate() - 6)
              setDateFrom(d.toLocaleDateString("en-CA"))
              setDateTo(todayStr())
            }}
            className="text-primary hover:underline"
          >
            Últimos 7 días
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            onClick={() => {
              const d = new Date()
              d.setDate(d.getDate() - 29)
              setDateFrom(d.toLocaleDateString("en-CA"))
              setDateTo(todayStr())
            }}
            className="text-primary hover:underline"
          >
            Últimos 30 días
          </button>
        </div>
      </div>

      {/* Totales globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Citas atendidas" value={totals.attended.toString()} />
        <StatCard label="Consultas registradas" value={totals.consultations.toString()} />
        <StatCard label="Servicios vendidos" value={totals.services.toString()} />
        <StatCard label="Ingreso total" value={fmt(totals.revenue)} highlight />
      </div>

      {/* Tabla por profesional */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Profesional</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground" title="Citas con status atendida">
                Atendidas
              </th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground" title="Citas canceladas o no-show">
                Canceladas
              </th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground" title="medical_records donde aparece como veterinario">
                Consultas
              </th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">Servicios</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">Productos</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Veterinaria</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Peluquería</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Estética</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  Cargando...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-destructive">
                  Error cargando el reporte: {(error as Error).message}
                </td>
              </tr>
            ) : professionals.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  No hay actividad de profesionales en el rango seleccionado.
                </td>
              </tr>
            ) : (
              professionals.map((p) => (
                <tr key={p.user_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.role_name}</p>
                  </td>
                  <td className="text-center px-3 py-3">{p.appointments_attended}</td>
                  <td className="text-center px-3 py-3 text-muted-foreground">
                    {p.appointments_cancelled}
                  </td>
                  <td className="text-center px-3 py-3">{p.consultations_count}</td>
                  <td className="text-center px-3 py-3 text-muted-foreground">{p.services_sold}</td>
                  <td className="text-center px-3 py-3 text-muted-foreground">{p.products_sold}</td>
                  <td className="text-right px-3 py-3 text-muted-foreground">
                    {Number(p.revenue_veterinary) > 0 ? fmt(Number(p.revenue_veterinary)) : "—"}
                  </td>
                  <td className="text-right px-3 py-3 text-muted-foreground">
                    {Number(p.revenue_grooming) > 0 ? fmt(Number(p.revenue_grooming)) : "—"}
                  </td>
                  <td className="text-right px-3 py-3 text-muted-foreground">
                    {Number(p.revenue_aesthetic) > 0 ? fmt(Number(p.revenue_aesthetic)) : "—"}
                  </td>
                  <td className="text-right px-4 py-3 font-semibold">
                    {fmt(Number(p.revenue_total))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg border bg-card p-4 ${
        highlight ? "border-primary bg-primary/5" : ""
      }`}
    >
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
