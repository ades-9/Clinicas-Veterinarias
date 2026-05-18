import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileSpreadsheet, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useApiClient } from "@/api/client"
import { usePermissions } from "@/hooks/usePermissions"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pagination } from "@/components/ui/pagination"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { sanitizeWeightInput, todayISO, validateBirthDate, validateWeight } from "@/lib/validators"
import type { Breed, OwnersList, Patient, PatientsList, Species } from "@/types"

interface PatientForm {
  owner_id: string
  name: string
  species_id: string
  breed_id: string
  birth_date: string
  weight: string
  sex: string                  // "", "male", "female"
  is_sterilized: string        // "", "true", "false"
  color: string
  microchip_number: string
  distinctive_marks: string
  allergies: string
  chronic_conditions: string
  temperament_notes: string
  lifestyle_notes: string
  grooming_preferences: string
  vaccination_code: string
  notes: string
}

const EMPTY: PatientForm = {
  owner_id: "", name: "", species_id: "", breed_id: "",
  birth_date: "", weight: "",
  sex: "", is_sterilized: "", color: "", microchip_number: "",
  distinctive_marks: "", allergies: "", chronic_conditions: "",
  temperament_notes: "", lifestyle_notes: "", grooming_preferences: "",
  vaccination_code: "", notes: "",
}

const PAGE_SIZE = 20

export function PatientsPage() {
  const api = useApiClient()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const { showSuccess, showError } = useToast()

  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null)
  const [editing, setEditing] = useState<Patient | null>(null)
  const [form, setForm] = useState<PatientForm>(EMPTY)
  const [error, setError] = useState("")
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["patients", search, page],
    queryFn: () => {
      const offset = (page - 1) * PAGE_SIZE
      return api.get<PatientsList>(
        `/patients?q=${encodeURIComponent(search)}&limit=${PAGE_SIZE}&offset=${offset}`
      )
    },
  })
  const patients = data?.items ?? []
  const total = data?.total ?? 0

  function handleSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  const { data: ownersData } = useQuery({
    queryKey: ["owners-all-for-select"],
    queryFn: () => api.get<OwnersList>("/owners?limit=200"),
    enabled: formOpen,
  })
  const owners = ownersData?.items ?? []

  const { data: speciesList = [] } = useQuery({
    queryKey: ["catalog-species"],
    queryFn: () => api.get<Species[]>("/catalog/species"),
    staleTime: Infinity,
  })

  const { data: breeds = [] } = useQuery({
    queryKey: ["catalog-breeds", form.species_id],
    queryFn: () =>
      api.get<Breed[]>(`/catalog/breeds?species_id=${form.species_id}`),
    enabled: !!form.species_id,
    staleTime: Infinity,
  })

  const createMutation = useMutation({
    mutationFn: (d: object) => api.post<Patient>("/patients", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] })
      closeForm()
      showSuccess("Mascota creada")
    },
    onError: (e: Error) => setError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.patch<Patient>(`/patients/${id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] })
      closeForm()
      showSuccess("Mascota actualizada")
    },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/patients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] })
      setDeleteTarget(null)
      showSuccess("Mascota eliminada")
    },
    onError: (e: Error) => setError(e.message),
  })

  function openCreate() {
    setEditing(null); setForm(EMPTY); setError(""); setFormOpen(true)
  }

  function openEdit(p: Patient) {
    setEditing(p)
    setForm({
      owner_id: p.owner_id,
      name: p.name,
      species_id: p.species_id ?? "",
      breed_id: p.breed_id ?? "",
      birth_date: p.birth_date ?? "",
      weight: p.weight?.toString() ?? "",
      sex: p.sex ?? "",
      is_sterilized: p.is_sterilized == null ? "" : String(p.is_sterilized),
      color: p.color ?? "",
      microchip_number: p.microchip_number ?? "",
      distinctive_marks: p.distinctive_marks ?? "",
      allergies: p.allergies ?? "",
      chronic_conditions: p.chronic_conditions ?? "",
      temperament_notes: p.temperament_notes ?? "",
      lifestyle_notes: p.lifestyle_notes ?? "",
      grooming_preferences: p.grooming_preferences ?? "",
      vaccination_code: p.vaccination_code ?? "",
      notes: p.notes ?? "",
    })
    setError(""); setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false); setEditing(null); setForm(EMPTY); setError("")
  }

  function buildPayload() {
    return {
      owner_id: form.owner_id,
      name: form.name,
      species_id: form.species_id || null,
      breed_id: form.breed_id || null,
      birth_date: form.birth_date || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      sex: form.sex || null,
      is_sterilized: form.is_sterilized === "" ? null : form.is_sterilized === "true",
      color: form.color || null,
      microchip_number: form.microchip_number || null,
      distinctive_marks: form.distinctive_marks || null,
      allergies: form.allergies || null,
      chronic_conditions: form.chronic_conditions || null,
      temperament_notes: form.temperament_notes || null,
      lifestyle_notes: form.lifestyle_notes || null,
      grooming_preferences: form.grooming_preferences || null,
      vaccination_code: form.vaccination_code || null,
      notes: form.notes || null,
    }
  }

  const birthDateError = useMemo(() => validateBirthDate(form.birth_date), [form.birth_date])
  const weightError = useMemo(() => validateWeight(form.weight), [form.weight])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("")
    if (birthDateError) { setError(birthDateError); return }
    if (weightError) { setError(weightError); return }
    if (editing) updateMutation.mutate({ id: editing.id, d: buildPayload() })
    else createMutation.mutate(buildPayload())
  }

  async function handleExport(format: "xlsx" | "pdf") {
    setExporting(true)
    try {
      const qs = search ? `?q=${encodeURIComponent(search)}` : ""
      await api.download(`/patients/export.${format}${qs}`, `mascotas.${format}`)
      showSuccess(`Exportado a ${format.toUpperCase()}`)
    } catch (e) {
      showError(e instanceof Error ? e.message : "Error al exportar")
    } finally {
      setExporting(false)
    }
  }

  function handleSpeciesChange(speciesId: string) {
    setForm((f) => ({ ...f, species_id: speciesId, breed_id: "" }))
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mascotas</h1>
          <p className="text-sm text-muted-foreground">Gestión de mascotas (mascotas)</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("xlsx")}
            disabled={exporting || total === 0}
            title="Exportar a Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={exporting || total === 0}
            title="Exportar a PDF"
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          {can("patients.create") && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nueva mascota
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nombre, propietario o código de vacuna..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Especie / Raza</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Propietario</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Peso</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cód. Vacuna</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Cargando...</td></tr>
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {search ? "Sin resultados para la búsqueda" : "No hay mascotas registrados"}
                </td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr
                  key={p.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/patients/${p.id}`)}
                >
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-3">
                      {p.photo_url ? (
                        <img
                          src={p.photo_url}
                          alt={p.name}
                          className="h-10 w-10 rounded-full object-cover border bg-muted shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full border bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[p.species_name, p.breed_name].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3">{p.owner_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.weight != null ? `${p.weight} kg` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.vaccination_code ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(p)
                        }}
                        className="rounded p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setError("")
                          setDeleteTarget(p)
                        }}
                        className="rounded p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />

      {/* Crear / Editar */}
      <Dialog open={formOpen} onClose={closeForm} title={editing ? "Editar mascota" : "Nuevo mascota"} className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Datos generales */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos generales</p>
            <div className="space-y-1.5">
              <Label htmlFor="owner_id">Propietario *</Label>
              <Select id="owner_id" required value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
                <option value="">Seleccionar propietario...</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="species_id">Especie</Label>
                <Select id="species_id" value={form.species_id} onChange={(e) => handleSpeciesChange(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {speciesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="breed_id">Raza</Label>
                <Select
                  id="breed_id"
                  value={form.breed_id}
                  disabled={!form.species_id}
                  onChange={(e) => setForm({ ...form, breed_id: e.target.value })}
                >
                  <option value="">{form.species_id ? "Seleccionar..." : "Primero elige especie"}</option>
                  {breeds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </div>
            </div>
          </div>

          {/* Características físicas */}
          <div className="space-y-3 pt-3 border-t">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Características</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sex">Sexo</Label>
                <Select id="sex" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                  <option value="">—</option>
                  <option value="male">Macho</option>
                  <option value="female">Hembra</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="is_sterilized">Esterilizado</Label>
                <Select id="is_sterilized" value={form.is_sterilized} onChange={(e) => setForm({ ...form, is_sterilized: e.target.value })}>
                  <option value="">Desconocido</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="color">Color</Label>
                <Input id="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="birth_date">Fecha de nacimiento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  max={todayISO()}
                  value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                />
                {form.birth_date && birthDateError && (
                  <p className="text-xs text-destructive">{birthDateError}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weight">Peso (kg)</Label>
                <Input
                  id="weight"
                  inputMode="decimal"
                  placeholder="Ej. 12.5"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: sanitizeWeightInput(e.target.value) })}
                />
                {form.weight && weightError && (
                  <p className="text-xs text-destructive">{weightError}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="microchip_number">Número de microchip</Label>
              <Input id="microchip_number" value={form.microchip_number} onChange={(e) => setForm({ ...form, microchip_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="distinctive_marks">Marcas distintivas (cicatrices, tatuajes, señas)</Label>
              <Textarea id="distinctive_marks" rows={2} value={form.distinctive_marks} onChange={(e) => setForm({ ...form, distinctive_marks: e.target.value })} />
            </div>
          </div>

          {/* Salud */}
          <div className="space-y-3 pt-3 border-t">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Salud</p>
            <div className="space-y-1.5">
              <Label htmlFor="allergies">Alergias / intolerancias</Label>
              <Textarea id="allergies" rows={2} value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chronic_conditions">Enfermedades crónicas</Label>
              <Textarea id="chronic_conditions" rows={2} value={form.chronic_conditions} onChange={(e) => setForm({ ...form, chronic_conditions: e.target.value })} />
            </div>
          </div>

          {/* Conducta y estilo de vida */}
          <div className="space-y-3 pt-3 border-t">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conducta y estilo de vida</p>
            <div className="space-y-1.5">
              <Label htmlFor="temperament_notes">Temperamento</Label>
              <Textarea
                id="temperament_notes"
                rows={2}
                value={form.temperament_notes}
                onChange={(e) => setForm({ ...form, temperament_notes: e.target.value })}
                placeholder="Ej. tranquilo, ansioso, agresivo con extraños..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lifestyle_notes">Estilo de vida (nutrición, entorno, actividad)</Label>
              <Textarea id="lifestyle_notes" rows={2} value={form.lifestyle_notes} onChange={(e) => setForm({ ...form, lifestyle_notes: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grooming_preferences">Preferencias de grooming</Label>
              <Textarea
                id="grooming_preferences"
                rows={2}
                value={form.grooming_preferences}
                onChange={(e) => setForm({ ...form, grooming_preferences: e.target.value })}
                placeholder="Ej. cuchilla #5, sin sacar pelo de orejas..."
              />
            </div>
          </div>

          {/* Otros */}
          <div className="space-y-3 pt-3 border-t">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Otros</p>
            <div className="space-y-1.5">
              <Label htmlFor="vaccination_code">Código de vacunación</Label>
              <Input id="vaccination_code" value={form.vaccination_code} onChange={(e) => setForm({ ...form, vaccination_code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notas generales</Label>
              <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button type="submit" disabled={isSaving || !!birthDateError || !!weightError}>
              {isSaving ? "Guardando..." : editing ? "Guardar cambios" : "Crear mascota"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Eliminar mascota">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Eliminar a <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
