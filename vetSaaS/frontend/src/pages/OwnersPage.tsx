import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useState } from "react"
import { useApiClient } from "@/api/client"
import { usePermissions } from "@/hooks/usePermissions"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import type { Owner } from "@/types"

interface OwnerForm {
  full_name: string
  id_number: string
  phone: string
  email: string
  address: string
  preferred_contact: string  // "", "whatsapp", "sms", "email", "phone"
}

const EMPTY: OwnerForm = {
  full_name: "", id_number: "", phone: "", email: "", address: "",
  preferred_contact: "",
}

export function OwnersPage() {
  const api = useApiClient()
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const { showSuccess } = useToast()

  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Owner | null>(null)
  const [editing, setEditing] = useState<Owner | null>(null)
  const [form, setForm] = useState<OwnerForm>(EMPTY)
  const [error, setError] = useState("")

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["owners", search],
    queryFn: () => api.get<Owner[]>(`/owners?q=${encodeURIComponent(search)}&limit=100`),
  })

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post<Owner>("/owners", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners"] })
      closeForm()
      showSuccess("Propietario creado")
    },
    onError: (e: Error) => setError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api.patch<Owner>(`/owners/${id}`, data),
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const payload = {
      full_name: form.full_name,
      id_number: form.id_number || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      preferred_contact: form.preferred_contact || null,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload })
    } else {
      createMutation.mutate(payload)
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
        {can("owners.create") && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo propietario
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nombre, email, teléfono o documento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
            <Label htmlFor="id_number">Documento de identidad</Label>
            <Input
              id="id_number"
              value={form.id_number}
              onChange={(e) => setForm({ ...form, id_number: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
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
            <Button type="submit" disabled={isSaving}>
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
