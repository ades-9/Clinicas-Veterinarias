import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Printer } from "lucide-react"
import type { ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useApiClient } from "@/api/client"
import { Button } from "@/components/ui/button"
import type { Clinic, Deworming, Owner, Patient, Surgery, Vaccination } from "@/types"

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function age(birthDate: string | null): string {
  if (!birthDate) return "—"
  const birth = new Date(birthDate)
  const now = new Date()
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem === 0 ? `${years} ${years === 1 ? "año" : "años"}` : `${years}a ${rem}m`
}

function ExtBadge({ name }: { name: string | null }) {
  return (
    <span
      title={name ? `Aplicada en ${name}` : "Aplicada en otra clínica"}
      className="ml-1 inline-flex items-center rounded-full border border-amber-400 bg-amber-50 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-amber-700 align-middle"
    >
      Ext.
    </span>
  )
}

export function PatientCarnetPage() {
  const { id: patientId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const api = useApiClient()

  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => api.get<Patient>(`/patients/${patientId}`),
    enabled: !!patientId,
  })

  const { data: owner } = useQuery({
    queryKey: ["owner", patient?.owner_id],
    queryFn: () => api.get<Owner>(`/owners/${patient!.owner_id}`),
    enabled: !!patient,
  })

  const { data: clinic } = useQuery({
    queryKey: ["configuration"],
    queryFn: () => api.get<Clinic>("/configuration"),
  })

  const { data: vaccinations = [] } = useQuery({
    queryKey: ["patient-vaccinations", patientId],
    queryFn: () => api.get<Vaccination[]>(`/patients/${patientId}/vaccinations`),
    enabled: !!patientId,
  })

  const { data: dewormings = [] } = useQuery({
    queryKey: ["patient-dewormings", patientId],
    queryFn: () => api.get<Deworming[]>(`/patients/${patientId}/dewormings`),
    enabled: !!patientId,
  })

  const { data: surgeries = [] } = useQuery({
    queryKey: ["patient-surgeries", patientId],
    queryFn: () => api.get<Surgery[]>(`/patients/${patientId}/surgeries`),
    enabled: !!patientId,
  })

  if (!patient || !owner) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Cargando carnet...</p>
      </div>
    )
  }

  const dewormingsInt = dewormings.filter((d) => d.treatment_type === "internal" || d.treatment_type === "both")
  const dewormingsExt = dewormings.filter((d) => d.treatment_type === "external" || d.treatment_type === "both")

  // Ordenar todo cronológicamente ascendente para el carnet
  const sortedVacc = [...vaccinations].sort(
    (a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime()
  )
  const sortedDewInt = [...dewormingsInt].sort(
    (a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime()
  )
  const sortedDewExt = [...dewormingsExt].sort(
    (a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime()
  )
  const sortedSurg = [...surgeries].sort(
    (a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime()
  )

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Toolbar — no se imprime */}
      <div className="print:hidden border-b bg-card px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-10">
        <button
          onClick={() => navigate(`/patients/${patientId}`)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al expediente
        </button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* Hoja imprimible */}
      <div className="mx-auto max-w-[210mm] bg-white p-10 my-6 shadow print:shadow-none print:my-0 print:max-w-none">
        {/* Header clínica */}
        <header className="border-b-2 border-primary pb-4 mb-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {clinic?.logo_url && (
              <img
                src={clinic.logo_url}
                alt={clinic.name}
                className="h-16 w-16 object-contain rounded border bg-white"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-primary">{clinic?.name ?? "Clínica Veterinaria"}</h1>
              {clinic?.address && <p className="text-sm text-muted-foreground">{clinic.address}</p>}
              {clinic?.phone && <p className="text-sm text-muted-foreground">Tel. {clinic.phone}</p>}
              {clinic?.email && <p className="text-sm text-muted-foreground">{clinic.email}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Carnet sanitario</p>
            <p className="text-xs text-muted-foreground">Emitido: {formatDate(new Date().toISOString())}</p>
          </div>
        </header>

        {/* Identificación de la mascota + propietario */}
        <section className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3 border-b pb-1">
              Identificación
            </h2>
            <div className="flex gap-4">
              {patient.photo_url && (
                <img
                  src={patient.photo_url}
                  alt={patient.name}
                  className="h-28 w-28 rounded-lg object-cover border bg-muted shrink-0"
                />
              )}
              <dl className="space-y-1 text-sm flex-1">
                <CarnetRow label="Nombre" value={patient.name} bold />
                <CarnetRow label="Especie" value={patient.species_name ?? "—"} />
                <CarnetRow label="Raza" value={patient.breed_name ?? "—"} />
                <CarnetRow label="Color" value={patient.color ?? "—"} />
                <CarnetRow
                  label="Sexo"
                  value={
                    patient.sex === "male" ? "Macho" : patient.sex === "female" ? "Hembra" : "—"
                  }
                />
                <CarnetRow
                  label="Esterilizado"
                  value={
                    patient.is_sterilized === true ? "Sí" :
                    patient.is_sterilized === false ? "No" : "—"
                  }
                />
                <CarnetRow
                  label="Nacimiento"
                  value={`${formatDate(patient.birth_date)} (${age(patient.birth_date)})`}
                />
                <CarnetRow label="Peso" value={patient.weight != null ? `${patient.weight} kg` : "—"} />
                <CarnetRow label="Microchip" value={patient.microchip_number ?? "—"} />
                <CarnetRow label="Marcas" value={patient.distinctive_marks ?? "—"} />
              </dl>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3 border-b pb-1">
              Propietario
            </h2>
            <dl className="space-y-1 text-sm">
              <CarnetRow label="Nombre" value={owner.full_name} bold />
              <CarnetRow label="Documento" value={owner.id_number ?? "—"} />
              <CarnetRow label="Teléfono" value={owner.phone ?? "—"} />
              <CarnetRow label="Email" value={owner.email ?? "—"} />
              <CarnetRow label="Dirección" value={owner.address ?? "—"} />
            </dl>

            {(patient.allergies || patient.chronic_conditions) && (
              <div className="mt-4 rounded border-l-4 border-destructive bg-destructive/5 p-2 text-xs">
                <p className="font-bold uppercase tracking-wider text-destructive mb-1">
                  Alertas médicas
                </p>
                {patient.allergies && (
                  <p>
                    <span className="font-medium">Alergias: </span>
                    {patient.allergies}
                  </p>
                )}
                {patient.chronic_conditions && (
                  <p>
                    <span className="font-medium">Crónicas: </span>
                    {patient.chronic_conditions}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Vacunaciones */}
        <CarnetTable
          title="Control de vacunación"
          empty="Sin vacunas registradas"
          headers={["Fecha", "Vacuna", "Marca / Lote", "Próxima dosis", "Peso", "Firma"]}
          rows={sortedVacc.map((v) => [
            formatDate(v.applied_at),
            <>
              {v.vaccine_name}
              {v.applied_externally && <ExtBadge name={v.external_clinic_name} />}
            </>,
            [v.manufacturer, v.batch_number && `Lote ${v.batch_number}`].filter(Boolean).join(" · ") || "—",
            formatDate(v.next_dose_at),
            v.weight_at_application != null ? `${v.weight_at_application} kg` : "—",
            "",
          ])}
        />

        {/* Desparasitaciones internas */}
        <CarnetTable
          title="Desparasitaciones internas"
          empty="Sin registros"
          headers={["Fecha", "Producto", "Marca / Lote", "Próxima dosis", "Peso", "Firma"]}
          rows={sortedDewInt.map((d) => [
            formatDate(d.applied_at),
            <>
              {d.product_name}
              {d.applied_externally && <ExtBadge name={d.external_clinic_name} />}
            </>,
            [d.manufacturer, d.batch_number && `Lote ${d.batch_number}`].filter(Boolean).join(" · ") || "—",
            formatDate(d.next_dose_at),
            d.weight_at_application != null ? `${d.weight_at_application} kg` : "—",
            "",
          ])}
        />

        {/* Desparasitaciones externas */}
        <CarnetTable
          title="Desparasitaciones externas"
          empty="Sin registros"
          headers={["Fecha", "Producto", "Marca / Lote", "Próxima dosis", "Peso", "Firma"]}
          rows={sortedDewExt.map((d) => [
            formatDate(d.applied_at),
            <>
              {d.product_name}
              {d.applied_externally && <ExtBadge name={d.external_clinic_name} />}
            </>,
            [d.manufacturer, d.batch_number && `Lote ${d.batch_number}`].filter(Boolean).join(" · ") || "—",
            formatDate(d.next_dose_at),
            d.weight_at_application != null ? `${d.weight_at_application} kg` : "—",
            "",
          ])}
        />

        {/* Cirugías */}
        {sortedSurg.length > 0 && (
          <CarnetTable
            title="Cirugías"
            empty="Sin cirugías registradas"
            headers={["Fecha", "Cirugía", "Veterinario", "Notas"]}
            rows={sortedSurg.map((s) => [
              formatDate(s.performed_at),
              <>
                {s.name}
                {s.applied_externally && <ExtBadge name={s.external_clinic_name} />}
              </>,
              s.veterinarian_name ?? "—",
              s.description ?? "—",
            ])}
          />
        )}

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
          Este carnet refleja la información registrada en {clinic?.name ?? "la clínica"} a la
          fecha de emisión. Conservelo y preséntelo en cada visita veterinaria.
        </footer>
      </div>

      {/* Estilos para impresión */}
      <style>{`
        @media print {
          body { background: white !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>
    </div>
  )
}

function CarnetRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <dt className="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">{label}</dt>
      <dd className={bold ? "font-semibold" : ""}>{value}</dd>
    </div>
  )
}

function CarnetTable({
  title,
  empty,
  headers,
  rows,
}: {
  title: string
  empty: string
  headers: string[]
  rows: ReactNode[][]
}) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="text-sm font-bold uppercase tracking-wider mb-2 border-b pb-1">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-2 py-1">{empty}</p>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-foreground/40">
              {headers.map((h, i) => (
                <th key={i} className="text-left px-2 py-1.5 font-semibold uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-b border-foreground/10">
                {r.map((c, ci) => {
                  const isEmpty = c === "" || c == null || c === false
                  return (
                    <td key={ci} className="px-2 py-1.5 align-top">
                      {isEmpty ? <span className="text-muted-foreground/40">—</span> : c}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
