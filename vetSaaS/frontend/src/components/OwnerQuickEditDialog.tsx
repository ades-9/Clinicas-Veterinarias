import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useApiClient } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import type { Owner } from "@/types"

interface QuickForm {
  id_number: string
  phone: string
  email: string
  address: string
  preferred_contact: string
}

const EMPTY: QuickForm = {
  id_number: "",
  phone: "",
  email: "",
  address: "",
  preferred_contact: "",
}

interface Props {
  open: boolean
  onClose: () => void
  ownerId: string
  ownerName: string
}

export function OwnerQuickEditDialog({ open, onClose, ownerId, ownerName }: Props) {
  const api = useApiClient()
  const qc = useQueryClient()
  const { showSuccess } = useToast()
  const [form, setForm] = useState<QuickForm>(EMPTY)
  const [error, setError] = useState("")

  const { data: owner } = useQuery({
    queryKey: ["owner", ownerId],
    queryFn: () => api.get<Owner>(`/owners/${ownerId}`),
    enabled: open,
  })

  useEffect(() => {
    if (open && owner) {
      setForm({
        id_number: owner.id_number ?? "",
        phone: owner.phone ?? "",
        email: owner.email ?? "",
        address: owner.address ?? "",
        preferred_contact: owner.preferred_contact ?? "",
      })
      setError("")
    }
  }, [open, owner])

  const mutation = useMutation({
    mutationFn: (data: object) => api.patch<Owner>(`/owners/${ownerId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner", ownerId] })
      qc.invalidateQueries({ queryKey: ["owners"] })
      onClose()
      showSuccess("Propietario actualizado")
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    mutation.mutate({
      id_number: form.id_number || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      preferred_contact: form.preferred_contact || null,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Editar propietario — ${ownerName}`}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Completá los datos administrativos que falten. El nombre se edita en la página de
          Propietarios.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="qo_doc" className="text-xs">Documento</Label>
          <Input
            id="qo_doc"
            value={form.id_number}
            onChange={(e) => setForm({ ...form, id_number: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="qo_phone" className="text-xs">Teléfono</Label>
            <Input
              id="qo_phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qo_email" className="text-xs">Email</Label>
            <Input
              id="qo_email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qo_address" className="text-xs">Dirección</Label>
          <Input
            id="qo_address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qo_contact" className="text-xs">Canal de contacto preferido</Label>
          <Select
            id="qo_contact"
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
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
