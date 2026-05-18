import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileSpreadsheet, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useApiClient } from "@/api/client"
import { usePermissions } from "@/hooks/usePermissions"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pagination } from "@/components/ui/pagination"
import { Select } from "@/components/ui/select"
import { sanitizeDigits, validateEcuadorId, validatePhone10 } from "@/lib/validators"
import type { Owner, OwnersList } from "@/types"

interface OwnerForm {
  full_name: string
  id_number: string
  phone: string
  email: string
  address: string
  preferred_contact: string
}

const EMPTY: OwnerForm = {
  full_name: "", id_number: "", phone: "", email: "", address: "",
  preferred_contact: "",
}

const PAGE_SIZE = 20

export function OwnersPage() {
  const api = useApiClient()
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const { showSuccess, showError } = useToast()

  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Owner | null>(null)
  const [editing, setEditing] = useState<Owner | null>(null)
  const [form, setForm] = useState<OwnerForm>(EMPTY)
  const [error, setError] = useState("")
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["owners", search, page],
    queryFn: () => {
      const offset = (page - 1) * PAGE_SIZE
      return api.get<OwnersList>(
        `/owners?q=${encodeURIComponent(search)}&limit=${PAGE_SIZE}&offset=${offset}`
      )
    },
  })
  const owners = data?.items ?? []
  const total = data?.total ?? 0

  function handleSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  const createMutation = useMutation({
    mutationFn: (payload: object) => api.post<Owner>("/owners", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners"] })
      closeForm()
      showSuccess("Propietario creado")
    },
    onError: (e: Error) => setError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: object }) =>
      api.patch<Owner>(`/owners/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners"] })
      closeForm()
      showSuccess("Propietario actualizado")
    },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/owners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners"] })
      setDeleteTarget(null)
      showSuccess("Propietario eliminado")
    },
    onError: (e: Error) => setError(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setError("")
    setFormOpen(true)
  }

  function openEdit(owner: Owner) {
    setEditing(owner)
    setForm({
      full_name: owner.full_name,
      id_number: owner.id_number ?? "",
      phone: owner.phone ?? "",
      email: owner.email ?? "",
      address: owner.address ?? "",
      preferred_contact: owner.preferred_contact ?? "",
    })
    setError("")
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setForm(EMPTY)
    setError("")
  }

  // Validaciones inline para los inputs
  const idError = useMemo(
    () => (form.id_number ? validateEcuadorId(form.id_number) : null),
    [form.id_number]
  )
  const phoneError = useMemo(() => validatePhone10(form.phone), [form.phone])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (idError) { setError(idError); return }
    if (phoneError) { setError(phoneError); return }

    const payload = {
      full_name: form.full_name,
      id_number: form.id_number || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      preferred_contact: form.preferred_contact || null,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  async function handleExport(format: "xlsx" | "pdf") {
    setExporting(true)
    try {
      const qs = search ? `?q=${encodeURIComponent(search)}` : ""
      await api.download(`/owners/export.${format}${qs}`, `propietarios.${format}`)
      showSuccess(`Exportado a ${format.toUpperCase()}`)
    } catch (e) {
      showError(e instanceof Error ? e.message : "Error al exportar")
    } finally {
      setExporting(false)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Propietarios</h1>
          <p className="text-sm text-muted-foreground">Gestión de propietarios de mascotas</p>
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
          {can("owners.create") && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nuevo propietario
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nombre, email, teléfono o documento..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Documento</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Teléfono</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dirección</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Cargando...
                </td>
              </tr>
            ) : owners.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {search ? "Sin resultados para la búsqueda" : "No hay propietarios registrados"}
                </td>
              </tr>
            ) : (
              owners.map((owner) => (
                <tr
                  key={owner.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{owner.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{owner.id_number ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{owner.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{owner.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{owner.address ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(owner)}
                        className="rounded p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setError(""); setDeleteTarget(owner) }}
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
      <Dialog
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Editar propietario" : "Nuevo propietario"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Nombre completo *</Label>
            <Input
              id="full_name"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="id_number">Cédula (10 dígitos)</Label>
            <Input
              id="id_number"
              inputMode="numeric"
              maxLength={10}
              value={form.id_number}
              onChange={(e) => setForm({ ...form, id_number: sanitizeDigits(e.target.value, 10) })}
              placeholder="1712345678"
            />
            {form.id_number && idError && (
              <p className="text-xs text-destructive">{idError}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono (10 dígitos)</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: sanitizeDigits(e.target.value, 10) })}
              placeholder="0991234567"
            />
            {form.phone && phoneError && (
              <p className="text-xs text-destructive">{phoneError}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preferred_contact">Canal de contacto preferido</Label>
            <Select
              id="preferred_contact"
              value={form.preferred_contact}
              onChange={(e) => setForm({ ...form, preferred_contact: e.target.value })}
            >
              <option value="">Sin preferencia</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="phone">Llamada</option>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !!idError || !!phoneError}>
              {isSaving ? "Guardando..." : editing ? "Guardar cambios" : "Crear propietario"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar propietario"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar a{" "}
            <span className="font-medium text-foreground">{deleteTarget?.full_name}</span>? Esta
            acción no se puede deshacer.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
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
