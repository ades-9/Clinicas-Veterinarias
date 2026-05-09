import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useApiClient } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Owner } from "@/types"

interface NewOwnerForm {
  full_name: string
  id_number: string
  phone: string
  email: string
}

const EMPTY_OWNER: NewOwnerForm = { full_name: "", id_number: "", phone: "", email: "" }

interface Props {
  value: Owner | null
  onChange: (owner: Owner | null) => void
}

export function OwnerCombobox({ value, onChange }: Props) {
  const api = useApiClient()
  const qc = useQueryClient()

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [createMode, setCreateMode] = useState(false)
  const [newOwner, setNewOwner] = useState<NewOwnerForm>(EMPTY_OWNER)
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

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["owners-search", debouncedQuery],
    queryFn: () =>
      api.get<Owner[]>(`/owners?q=${encodeURIComponent(debouncedQuery)}&limit=20`),
    enabled: debouncedQuery.length > 0 && !createMode,
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post<Owner>("/owners", data),
    onSuccess: (owner) => {
      qc.invalidateQueries({ queryKey: ["owners"] })
      qc.invalidateQueries({ queryKey: ["owners-search"] })
      onChange(owner)
      setNewOwner(EMPTY_OWNER)
      setCreateMode(false)
      setError("")
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleSelect(owner: Owner) {
    onChange(owner)
    setQuery("")
    setDropdownOpen(false)
  }

  function handleClear() {
    onChange(null)
    setQuery("")
  }

  function handleOpenCreate() {
    setNewOwner({ ...EMPTY_OWNER, full_name: query })
    setCreateMode(true)
    setDropdownOpen(false)
    setError("")
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    setError("")
    if (!newOwner.full_name.trim()) {
      setError("El nombre es obligatorio")
      return
    }
    createMutation.mutate({
      full_name: newOwner.full_name,
      id_number: newOwner.id_number || null,
      phone: newOwner.phone || null,
      email: newOwner.email || null,
    })
  }

  function handleCancelCreate() {
    setCreateMode(false)
    setNewOwner(EMPTY_OWNER)
    setError("")
  }

  // Selected — pill view
  if (value) {
    return (
      <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm">
        <span className="flex-1 font-medium truncate">{value.full_name}</span>
        {value.phone && <span className="text-muted-foreground text-xs">{value.phone}</span>}
        <button
          type="button"
          onClick={handleClear}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Quitar propietario"
        >
          <X className="h-3.5 w-3.5" />
        </button>
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
              placeholder="Buscar propietario por nombre, teléfono o email..."
              value={query}
              onFocus={() => setDropdownOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value)
                setDropdownOpen(true)
              }}
            />
            {dropdownOpen && debouncedQuery.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-lg overflow-hidden">
                {isFetching ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
                ) : results.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Sin resultados.
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="text-primary hover:underline ml-1"
                    >
                      Crear "{debouncedQuery}"
                    </button>
                  </div>
                ) : (
                  <ul className="max-h-48 overflow-y-auto">
                    {results.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                          onClick={() => handleSelect(o)}
                        >
                          <span className="font-medium">{o.full_name}</span>
                          {o.phone && (
                            <span className="text-muted-foreground ml-2 text-xs">{o.phone}</span>
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
            title="Crear nuevo propietario"
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
              Nuevo propietario
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
              <Label htmlFor="oc_name" className="text-xs">Nombre completo *</Label>
              <Input
                id="oc_name"
                value={newOwner.full_name}
                onChange={(e) => setNewOwner({ ...newOwner, full_name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="oc_doc" className="text-xs">Documento</Label>
                <Input
                  id="oc_doc"
                  value={newOwner.id_number}
                  onChange={(e) => setNewOwner({ ...newOwner, id_number: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="oc_phone" className="text-xs">Teléfono</Label>
                <Input
                  id="oc_phone"
                  type="tel"
                  value={newOwner.phone}
                  onChange={(e) => setNewOwner({ ...newOwner, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="oc_email" className="text-xs">Email</Label>
              <Input
                id="oc_email"
                type="email"
                value={newOwner.email}
                onChange={(e) => setNewOwner({ ...newOwner, email: e.target.value })}
              />
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
