import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useApiClient } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import type { Breed, Patient, Species } from "@/types"

interface NewPatientForm {
  name: string
  species_id: string
  breed_id: string
  sex: string
}

const EMPTY_PATIENT: NewPatientForm = { name: "", species_id: "", breed_id: "", sex: "" }

interface Props {
  ownerId: string | null
  value: Patient | null
  onChange: (patient: Patient | null) => void
}

export function PatientCombobox({ ownerId, value, onChange }: Props) {
  const api = useApiClient()
  const qc = useQueryClient()

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [createMode, setCreateMode] = useState(false)
  const [newPatient, setNewPatient] = useState<NewPatientForm>(EMPTY_PATIENT)
  const [error, setError] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Reset cuando cambia el dueño
  useEffect(() => {
    setQuery("")
    setNewPatient(EMPTY_PATIENT)
    setCreateMode(false)
    setError("")
  }, [ownerId])

  const { data: resultsData, isFetching } = useQuery({
    queryKey: ["patients-by-owner", ownerId, debouncedQuery],
    queryFn: () =>
      api.get<{ items: Patient[]; total: number }>(
        `/patients?owner_id=${ownerId}${debouncedQuery ? `&q=${encodeURIComponent(debouncedQuery)}` : ""}&limit=20`
      ),
    enabled: !!ownerId && !createMode && (dropdownOpen || debouncedQuery.length > 0),
    staleTime: 30_000,
  })
  const results = resultsData?.items ?? []

  const { data: speciesList = [] } = useQuery({
    queryKey: ["catalog-species"],
    queryFn: () => api.get<Species[]>("/catalog/species"),
    enabled: createMode,
    staleTime: Infinity,
  })

  const { data: breeds = [] } = useQuery({
    queryKey: ["catalog-breeds", newPatient.species_id],
    queryFn: () => api.get<Breed[]>(`/catalog/breeds?species_id=${newPatient.species_id}`),
    enabled: createMode && !!newPatient.species_id,
    staleTime: Infinity,
  })

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post<Patient>("/patients", data),
    onSuccess: (patient) => {
      qc.invalidateQueries({ queryKey: ["patients"] })
      qc.invalidateQueries({ queryKey: ["patients-by-owner"] })
      onChange(patient)
      setNewPatient(EMPTY_PATIENT)
      setCreateMode(false)
      setError("")
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleSelect(p: Patient) {
    onChange(p)
    setQuery("")
    setDropdownOpen(false)
  }

  function handleClear() {
    onChange(null)
    setQuery("")
  }

  function handleOpenCreate() {
    setNewPatient({ ...EMPTY_PATIENT, name: query })
    setCreateMode(true)
    setDropdownOpen(false)
    setError("")
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    setError("")
    if (!ownerId) {
      setError("Selecciona primero un propietario")
      return
    }
    if (!newPatient.name.trim()) {
      setError("El nombre es obligatorio")
      return
    }
    createMutation.mutate({
      owner_id: ownerId,
      name: newPatient.name,
      species_id: newPatient.species_id || null,
      breed_id: newPatient.breed_id || null,
      sex: newPatient.sex || null,
    })
  }

  function handleCancelCreate() {
    setCreateMode(false)
    setNewPatient(EMPTY_PATIENT)
    setError("")
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm">
        <span className="flex-1 font-medium truncate">{value.name}</span>
        {value.species_name && (
          <span className="text-muted-foreground text-xs">{value.species_name}</span>
        )}
        <button
          type="button"
          onClick={handleClear}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Quitar mascota"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  if (!ownerId) {
    return (
      <div className="flex items-center h-9 px-3 rounded-md border border-input bg-muted/30 text-sm text-muted-foreground">
        Selecciona primero un propietario
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {!createMode && (
        <div className="flex gap-2">
          <div ref={containerRef} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Buscar mascota..."
              value={query}
              onFocus={() => setDropdownOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value)
                setDropdownOpen(true)
              }}
            />
            {dropdownOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-lg overflow-hidden">
                {isFetching ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
                ) : results.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {debouncedQuery
                      ? `Sin resultados.`
                      : "Este propietario no tiene mascotas."}
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="text-primary hover:underline ml-1"
                    >
                      {debouncedQuery ? `Crear "${debouncedQuery}"` : "Crear mascota"}
                    </button>
                  </div>
                ) : (
                  <ul className="max-h-48 overflow-y-auto">
                    {results.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                          onClick={() => handleSelect(p)}
                        >
                          <span className="font-medium">{p.name}</span>
                          {p.species_name && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              {p.species_name}
                              {p.breed_name && ` · ${p.breed_name}`}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Crear nuevo mascota"
            onClick={handleOpenCreate}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {createMode && (
        <div className="rounded-md border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nuevo mascota
            </p>
            <button
              type="button"
              onClick={handleCancelCreate}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cancelar creación"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="pc_name" className="text-xs">Nombre *</Label>
              <Input
                id="pc_name"
                value={newPatient.name}
                onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="pc_species" className="text-xs">Especie</Label>
                <Select
                  id="pc_species"
                  value={newPatient.species_id}
                  onChange={(e) =>
                    setNewPatient({ ...newPatient, species_id: e.target.value, breed_id: "" })
                  }
                >
                  <option value="">—</option>
                  {speciesList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pc_breed" className="text-xs">Raza</Label>
                <Select
                  id="pc_breed"
                  value={newPatient.breed_id}
                  disabled={!newPatient.species_id}
                  onChange={(e) => setNewPatient({ ...newPatient, breed_id: e.target.value })}
                >
                  <option value="">—</option>
                  {breeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pc_sex" className="text-xs">Sexo</Label>
              <Select
                id="pc_sex"
                value={newPatient.sex}
                onChange={(e) => setNewPatient({ ...newPatient, sex: e.target.value })}
              >
                <option value="">—</option>
                <option value="male">Macho</option>
                <option value="female">Hembra</option>
              </Select>
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleCancelCreate}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creando..." : "Crear y seleccionar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
