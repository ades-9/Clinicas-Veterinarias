import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useApiClient } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import type { Owner, Patient } from "@/types"

// ── Búsqueda de mascota con creación inline ─────────────────────────────────

interface PatientSearchProps {
  value: Patient | null
  onChange: (patient: Patient | null) => void
}

export function PatientSearch({ value, onChange }: PatientSearchProps) {
  const api = useApiClient()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["patients-search", debouncedQuery],
    queryFn: () =>
      api.get<Patient[]>(`/patients?q=${encodeURIComponent(debouncedQuery)}&limit=20`),
    enabled: debouncedQuery.length > 0,
    staleTime: 30_000,
  })

  function handleSelect(patient: Patient) {
    onChange(patient)
    setQuery("")
    setOpen(false)
  }

  function handleClear() {
    onChange(null)
    setQuery("")
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm">
        <span className="flex-1 font-medium">{value.name}</span>
        <span className="text-muted-foreground">— {value.owner_name}</span>
        <button
          type="button"
          onClick={handleClear}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="flex gap-2">
        <div ref={containerRef} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Buscar mascota por nombre o propietario..."
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
          />
          {open && debouncedQuery.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-lg overflow-hidden">
              {isFetching ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
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
                        <span className="text-muted-foreground ml-2">— {p.owner_name}</span>
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
          onClick={() => setNewOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <NewPatientDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(patient) => {
          handleSelect(patient)
          setNewOpen(false)
        }}
      />
    </>
  )
}

// ── Crear mascota (sin salir del modal de cita) ──────────────────────────────

interface NewPatientDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (patient: Patient) => void
}

interface NewPatientForm {
  owner_id: string
  name: string
  species: string
  breed: string
}

const EMPTY_PATIENT: NewPatientForm = { owner_id: "", name: "", species: "", breed: "" }

function NewPatientDialog({ open, onClose, onCreated }: NewPatientDialogProps) {
  const api = useApiClient()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<NewPatientForm>(EMPTY_PATIENT)
  const [error, setError] = useState("")
  const [newOwnerOpen, setNewOwnerOpen] = useState(false)

  const { data: owners = [] } = useQuery({
    queryKey: ["owners"],
    queryFn: () => api.get<Owner[]>("/owners?limit=200"),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (data: object) => api.post<Patient>("/patients", data),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] })
      onCreated(patient)
      setForm(EMPTY_PATIENT)
      setError("")
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleClose() {
    setForm(EMPTY_PATIENT)
    setError("")
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    mutation.mutate({
      owner_id: form.owner_id,
      name: form.name,
      species: form.species || null,
      breed: form.breed || null,
    })
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Nuevo mascota" className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Propietario *</Label>
          <div className="flex gap-2">
            <Select
              className="flex-1"
              required
              value={form.owner_id}
              onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
            >
              <option value="">Seleccionar propietario...</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.full_name}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Crear nuevo propietario"
              onClick={() => setNewOwnerOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="np_name">Nombre *</Label>
          <Input
            id="np_name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="np_species">Especie</Label>
            <Input
              id="np_species"
              placeholder="Perro, Gato..."
              value={form.species}
              onChange={(e) => setForm({ ...form, species: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np_breed">Raza</Label>
            <Input
              id="np_breed"
              value={form.breed}
              onChange={(e) => setForm({ ...form, breed: e.target.value })}
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creando..." : "Crear mascota"}
          </Button>
        </div>
      </form>

      <NewOwnerDialog
        open={newOwnerOpen}
        onClose={() => setNewOwnerOpen(false)}
        onCreated={(owner) => {
          queryClient.invalidateQueries({ queryKey: ["owners"] })
          setForm((f) => ({ ...f, owner_id: owner.id }))
          setNewOwnerOpen(false)
        }}
      />
    </Dialog>
  )
}

// ── Crear propietario (sin salir del flujo de cita → mascota) ────────────────

interface NewOwnerDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (owner: Owner) => void
}

interface NewOwnerForm {
  full_name: string
  phone: string
  email: string
}

const EMPTY_OWNER: NewOwnerForm = { full_name: "", phone: "", email: "" }

function NewOwnerDialog({ open, onClose, onCreated }: NewOwnerDialogProps) {
  const api = useApiClient()
  const [form, setForm] = useState<NewOwnerForm>(EMPTY_OWNER)
  const [error, setError] = useState("")

  const mutation = useMutation({
    mutationFn: (data: object) => api.post<Owner>("/owners", data),
    onSuccess: (owner) => {
      onCreated(owner)
      setForm(EMPTY_OWNER)
      setError("")
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleClose() {
    setForm(EMPTY_OWNER)
    setError("")
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    mutation.mutate({
      full_name: form.full_name,
      phone: form.phone || null,
      email: form.email || null,
    })
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Nuevo propietario" className="max-w-xs">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="no_full_name">Nombre completo *</Label>
          <Input
            id="no_full_name"
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="no_phone">Teléfono</Label>
          <Input
            id="no_phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="no_email">Email</Label>
          <Input
            id="no_email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creando..." : "Crear propietario"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
