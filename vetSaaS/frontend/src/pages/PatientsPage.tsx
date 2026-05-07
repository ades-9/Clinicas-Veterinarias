import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useState } from "react"
import { useApiClient } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Breed, Owner, Patient, Species } from "@/types"

interface PatientForm {
  owner_id: string
  name: string
  species_id: string
  breed_id: string
  birth_date: string
  weight: string
  vaccination_code: string
  notes: string
}

const EMPTY: PatientForm = {
  owner_id: "", name: "", species_id: "", breed_id: "",
  birth_date: "", weight: "", vaccination_code: "", notes: "",
}

export function PatientsPage() {
  const api = useApiClient()
  const qc = useQueryClient()

  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null)
  const [editing, setEditing] = useState<Patient | null>(null)
  const [form, setForm] = useState<PatientForm>(EMPTY)
  const [error, setError] = useState("")

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients", search],
    queryFn: () => api.get<Patient[]>(`/patients?q=${encodeURIComponent(search)}&limit=100`),
  })

  const { data: owners = [] } = useQuery({
    queryKey: ["owners"],
    queryFn: () => api.get<Owner[]>("/owners?limit=200"),
    enabled: formOpen,
  })

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["patients"] }); closeForm() },
    onError: (e: Error) => setError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.patch<Patient>(`/patients/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["patients"] }); closeForm() },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/patients/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["patients"] }); setDeleteTarget(null) },
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
      vaccination_code: form.vaccination_code || null,
      notes: form.notes || null,
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("")
    if (editing) updateMutation.mutate({ id: editing.id, d: buildPayload() })
    else createMutation.mutate(buildPayload())
  }

  function handleSpeciesChange(speciesId: string) {
    setForm((f) => ({ ...f, species_id: speciesId, breed_id: "" }))
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pacientes</h1>
          <p className="text-sm text-muted-foreground">Gestión de pacientes (mascotas)</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo paciente
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nombre, propietario o código de vacuna..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
                  {search ? "Sin resultados para la búsqueda" : "No hay pacientes registrados"}
                </td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
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
                        onClick={() => openEdit(p)}
                        className="rounded p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setError(""); setDeleteTarget(p) }}
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

      {/* Crear / Editar */}
      <Dialog open={formOpen} onClose={closeForm} title={editing ? "Editar paciente" : "Nuevo paciente"} className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="birth_date">Fecha de nacimiento</Label>
              <Input id="birth_date" type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight">Peso (kg)</Label>
              <Input id="weight" type="number" step="0.01" min="0" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vaccination_code">Código de vacunación</Label>
            <Input id="vaccination_code" value={form.vaccination_code} onChange={(e) => setForm({ ...form, vaccination_code: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : editing ? "Guardar cambios" : "Crear paciente"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Eliminar paciente">
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
