import { useQuery } from "@tanstack/react-query"
import { Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useApiClient } from "@/api/client"
import { Input } from "@/components/ui/input"
import type { User, UserArea } from "@/types"

interface Props {
  value: User | null
  onChange: (user: User | null) => void
  /** Si se provee, solo aparecen usuarios cuyo `areas` incluya este valor (o tengan areas vacío). */
  areaFilter?: UserArea | null
}

export function AssigneeCombobox({ value, onChange, areaFilter }: Props) {
  const api = useApiClient()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
    staleTime: 60_000,
  })

  const byArea = areaFilter
    ? users.filter((u) => u.areas.length === 0 || u.areas.includes(areaFilter))
    : users
  const filtered = query.trim()
    ? byArea.filter(
        (u) =>
          u.full_name.toLowerCase().includes(query.toLowerCase()) ||
          u.role_name?.toLowerCase().includes(query.toLowerCase())
      )
    : byArea

  function handleSelect(u: User) {
    onChange(u)
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
        <span className="flex-1 font-medium truncate">{value.full_name}</span>
        {value.role_name && (
          <span className="text-muted-foreground text-xs">{value.role_name}</span>
        )}
        <button
          type="button"
          onClick={handleClear}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Quitar asignado"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        className="pl-9"
        placeholder="Buscar profesional..."
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-lg overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto">
              {filtered.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => handleSelect(u)}
                  >
                    <span className="font-medium">{u.full_name}</span>
                    {u.role_name && (
                      <span className="text-muted-foreground ml-2 text-xs">{u.role_name}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
