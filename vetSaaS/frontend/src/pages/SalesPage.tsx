import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CreditCard, Minus, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useApiClient } from "@/api/client"
import { usePermissions } from "@/hooks/usePermissions"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type {
  Appointment,
  AppointmentService,
  Owner,
  Patient,
  Product,
  Sale,
  SaleItem,
  SaleStatus,
  User,
} from "@/types"
import { SALE_STATUS_LABELS } from "@/types"

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}

// ── cart item ─────────────────────────────────────────────────────────────────

interface CartItem {
  id: string
  type: "product" | "service"
  name: string
  quantity: number
  unit_price: number
  max_stock?: number
  professional_user_id?: string | null
}

// ── component ─────────────────────────────────────────────────────────────────

export function SalesPage() {
  const api = useApiClient()
  const qc = useQueryClient()
  const { can } = usePermissions()
  const { showSuccess } = useToast()

  const [newSaleOpen, setNewSaleOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [appointmentId, setAppointmentId] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [patientId, setPatientId] = useState("")
  const [notes, setNotes] = useState("")
  const [newSaleSellerId, setNewSaleSellerId] = useState("")
  const [saleError, setSaleError] = useState("")

  const [detailSale, setDetailSale] = useState<Sale | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [statusFilter, setStatusFilter] = useState<SaleStatus | "">("pending")

  // ── queries ───────────────────────────────────────────────────────────────

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales", statusFilter],
    queryFn: () =>
      api.get<Sale[]>(`/sales?limit=100${statusFilter ? `&status=${statusFilter}` : ""}`),
  })

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: () => api.get<Product[]>("/products?limit=200"),
    enabled: newSaleOpen,
  })

  const { data: services = [] } = useQuery({
    queryKey: ["appointment-services"],
    queryFn: () => api.get<AppointmentService[]>("/appointment-services"),
    enabled: newSaleOpen,
  })

  const { data: owners = [] } = useQuery({
    queryKey: ["owners-all"],
    queryFn: () => api.get<Owner[]>("/owners?limit=200"),
    enabled: newSaleOpen,
  })

  const { data: allPatients = [] } = useQuery({
    queryKey: ["patients-all"],
    queryFn: () => api.get<Patient[]>("/patients?limit=500"),
    enabled: newSaleOpen,
  })

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments-recent"],
    queryFn: () => api.get<Appointment[]>("/appointments?limit=50&offset=0"),
    enabled: newSaleOpen,
  })

  const { data: newSaleUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
    enabled: newSaleOpen,
    staleTime: 60_000,
  })

  // Mascotas filtradas por propietario seleccionado
  const patients = ownerId
    ? allPatients.filter((p) => p.owner_id === ownerId)
    : allPatients

  // ── mutations ─────────────────────────────────────────────────────────────

  const createSale = useMutation({
    mutationFn: (d: object) => api.post<Sale>("/sales", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] })
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["products-active"] })
      closeNewSale()
      showSuccess("Venta creada")
    },
    onError: (e: Error) => setSaleError(e.message),
  })

  const deleteSale = useMutation({
    mutationFn: (id: string) => api.post(`/sales/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] })
      qc.invalidateQueries({ queryKey: ["products"] })
      setDeleteTarget(null)
      showSuccess("Venta cancelada")
    },
    onError: (e: Error) => setDeleteError(e.message),
  })

  const finalizeSale = useMutation({
    mutationFn: (id: string) => api.post<Sale>(`/sales/${id}/finalize`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] })
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["products-active"] })
      qc.invalidateQueries({ queryKey: ["products-search"] })
      showSuccess("Venta cobrada")
    },
  })

  // ── form helpers ──────────────────────────────────────────────────────────

  function closeNewSale() {
    setNewSaleOpen(false)
    setCart([])
    setAppointmentId("")
    setOwnerId("")
    setPatientId("")
    setNotes("")
    setNewSaleSellerId("")
    setSaleError("")
  }

  function handleAppointmentChange(apptId: string) {
    setAppointmentId(apptId)
    if (!apptId) return
    const appt = appointments.find((a) => a.id === apptId)
    if (appt) {
      setOwnerId(appt.owner_id)
      setPatientId(appt.patient_id)
    }
  }

  function handleOwnerChange(id: string) {
    setOwnerId(id)
    setPatientId("")
    if (!id) setAppointmentId("")
  }

  function addProduct(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.type === "product" && i.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.type === "product" && i.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [...prev, {
        id: product.id, type: "product", name: product.name,
        quantity: 1, unit_price: product.price, max_stock: product.stock,
      }]
    })
  }

  function addService(service: AppointmentService) {
    setCart((prev) => {
      const existing = prev.find((i) => i.type === "service" && i.id === service.id)
      if (existing) return prev
      return [...prev, {
        id: service.id, type: "service", name: service.name,
        quantity: 1, unit_price: service.price,
      }]
    })
  }

  function updateQty(id: string, type: CartItem["type"], qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => !(i.id === id && i.type === type)))
    } else {
      setCart((prev) => prev.map((i) =>
        i.id === id && i.type === type ? { ...i, quantity: qty } : i
      ))
    }
  }

  function updatePrice(id: string, type: CartItem["type"], price: number) {
    setCart((prev) => prev.map((i) =>
      i.id === id && i.type === type ? { ...i, unit_price: price } : i
    ))
  }

  const cartTotal = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0)

  function handleCreateSale(e: React.FormEvent) {
    e.preventDefault(); setSaleError("")
    if (cart.length === 0) { setSaleError("Agrega al menos un ítem"); return }
    createSale.mutate({
      appointment_id: appointmentId || null,
      patient_id: patientId || null,
      owner_id: ownerId || null,
      notes: notes || null,
      items: cart.map((i) => ({
        product_id: i.type === "product" ? i.id : null,
        service_id: i.type === "service" ? i.id : null,
        quantity: i.quantity,
        unit_price: i.unit_price,
        professional_user_id: newSaleSellerId || null,
      })),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ventas</h1>
          <p className="text-sm text-muted-foreground">Registro de ventas de productos y servicios</p>
        </div>
        {can("sales.create") && (
          <Button onClick={() => setNewSaleOpen(true)}>
            <ShoppingCart className="h-4 w-4" />
            Nueva venta
          </Button>
        )}
      </div>

      {/* Tabs filtro por estado */}
      <div className="flex rounded-md border overflow-hidden w-fit">
        {([
          { value: "pending", label: "Pendientes de cobro" },
          { value: "completed", label: "Cobradas" },
          { value: "cancelled", label: "Canceladas" },
          { value: "", label: "Todas" },
        ] as const).map((opt) => (
          <button
            key={opt.value || "all"}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 text-sm transition-colors ${
              statusFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* tabla de ventas */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mascota</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Propietario</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Ítems</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Cargando...</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No hay ventas en este filtro</td></tr>
            ) : (
              sales.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">{s.patient_name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.owner_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        s.status === "pending"
                          ? "warning"
                          : s.status === "completed"
                          ? "success"
                          : "destructive"
                      }
                    >
                      {SALE_STATUS_LABELS[s.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(s.total)}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{s.items.length}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {s.status === "pending" && (
                        <button
                          onClick={() => finalizeSale.mutate(s.id)}
                          disabled={finalizeSale.isPending}
                          className="rounded px-2 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1"
                          title="Cobrar venta"
                        >
                          <CreditCard className="h-3 w-3" />
                          Cobrar
                        </button>
                      )}
                      <button
                        onClick={() => setDetailSale(s)}
                        className="rounded px-2 py-1 text-xs hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Ver
                      </button>
                      {s.status !== "cancelled" && (
                        <button
                          onClick={() => { setDeleteError(""); setDeleteTarget(s) }}
                          className="rounded p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Cancelar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal nueva venta */}
      <Dialog open={newSaleOpen} onClose={closeNewSale} title="Nueva venta">
        <form onSubmit={handleCreateSale} className="space-y-5">

          {/* Vincular cita */}
          <div className="space-y-1.5">
            <Label htmlFor="s-appt">Cita (opcional)</Label>
            <select
              id="s-appt"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={appointmentId}
              onChange={(e) => handleAppointmentChange(e.target.value)}
            >
              <option value="">Sin cita vinculada</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {new Date(a.scheduled_at).toLocaleDateString("es", { day: "numeric", month: "short" })}
                  {" — "}{a.patient_name} · {a.services.map((s) => s.name).join(" + ")}
                </option>
              ))}
            </select>
          </div>

          {/* Propietario / Mascota */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-owner">Propietario</Label>
              <select
                id="s-owner"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={ownerId}
                onChange={(e) => handleOwnerChange(e.target.value)}
              >
                <option value="">Sin propietario</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-patient">Mascota</Label>
              <select
                id="s-patient"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              >
                <option value="">Sin mascota</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{!ownerId ? ` (${p.owner_name})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vendedor */}
          <div className="space-y-1.5">
            <Label htmlFor="s-seller">Vendedor (profesional)</Label>
            <select
              id="s-seller"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={newSaleSellerId}
              onChange={(e) => setNewSaleSellerId(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {newSaleUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Quién prestó el servicio o vendió los productos. Se usa para reportes de rendimiento.
            </p>
          </div>

          {/* Agregar productos */}
          <div className="space-y-2">
            <Label>Productos disponibles</Label>
            <div className="max-h-32 overflow-y-auto rounded-md border divide-y">
              {products.filter((p) => p.is_active && p.stock > 0).length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Sin productos en stock</p>
              ) : (
                products.filter((p) => p.is_active && p.stock > 0).map((p) => (
                  <button
                    key={p.id} type="button" onClick={() => addProduct(p)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                  >
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">Stock: {p.stock}</span>
                    </span>
                    <span className="text-muted-foreground">{fmt(p.price)}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Agregar servicios */}
          <div className="space-y-2">
            <Label>Servicios del tarifario</Label>
            <div className="max-h-28 overflow-y-auto rounded-md border divide-y">
              {services.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Sin servicios configurados</p>
              ) : (
                services.map((s) => (
                  <button
                    key={s.id} type="button" onClick={() => addService(s)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground">{fmt(s.price)}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Carrito */}
          {cart.length > 0 && (
            <div className="space-y-2">
              <Label>Carrito</Label>
              <div className="rounded-md border divide-y">
                {cart.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 px-3 py-2">
                    <span className="flex-1 text-sm truncate">
                      <span className="font-medium">{item.name}</span>
                      <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded ${item.type === "service" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {item.type === "service" ? "servicio" : "producto"}
                      </span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => updateQty(item.id, item.type, item.quantity - 1)}>
                        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <span className="w-7 text-center text-sm">{item.quantity}</span>
                      <button type="button" onClick={() => updateQty(item.id, item.type, item.quantity + 1)}>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    <Input
                      type="number" min="0" step="0.01"
                      className="w-24 text-right"
                      value={item.unit_price}
                      onChange={(e) => updatePrice(item.id, item.type, parseFloat(e.target.value) || 0)}
                    />
                    <button type="button" onClick={() => updateQty(item.id, item.type, 0)}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-1">
                <span className="text-sm font-semibold">Total: {fmt(cartTotal)}</span>
              </div>
            </div>
          )}

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="s-notes">Notas</Label>
            <Input id="s-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {saleError && <p className="text-sm text-destructive">{saleError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeNewSale}>Cancelar</Button>
            <Button type="submit" disabled={createSale.isPending || cart.length === 0}>
              {createSale.isPending ? "Procesando..." : `Confirmar${cart.length > 0 ? ` ${fmt(cartTotal)}` : ""}`}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Detalle / Edición venta */}
      {detailSale && (
        <SaleDetailDialog
          sale={detailSale}
          onClose={() => setDetailSale(null)}
          onUpdated={(updated) => setDetailSale(updated)}
          onFinalized={() => setDetailSale(null)}
        />
      )}

      {/* Confirmar anulación */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Anular venta">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Anular la venta{" "}
            <span className="font-medium text-foreground">{deleteTarget?.id.slice(0, 8).toUpperCase()}</span>?
            El stock no se reversa automáticamente.
          </p>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteSale.isPending}
              onClick={() => deleteTarget && deleteSale.mutate(deleteTarget.id)}
            >
              {deleteSale.isPending ? "Anulando..." : "Anular"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function SaleItemsTable({ items }: { items: SaleItem[] }) {
  return (
    <table className="w-full text-sm border rounded-md overflow-hidden">
      <thead className="bg-muted/50 border-b">
        <tr>
          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Ítem</th>
          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cant.</th>
          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Precio u.</th>
          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-b last:border-0">
            <td className="px-3 py-2">
              <span>{item.item_name}</span>
              <span className={`ml-1.5 text-xs px-1 py-0.5 rounded ${item.service_id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {item.service_id ? "servicio" : "producto"}
              </span>
            </td>
            <td className="px-3 py-2 text-right">{item.quantity}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.unit_price)}
            </td>
            <td className="px-3 py-2 text-right font-medium">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.subtotal)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Modal de detalle / edición de una venta ───────────────────────────────────

interface EditableItem {
  // Si tiene id, es item existente (puede haber sido modificado)
  existingId?: string
  type: "product" | "service"
  id: string
  name: string
  quantity: number
  unit_price: number
  professional_user_id: string | null
  professional_name: string | null
}

interface SaleDetailDialogProps {
  sale: Sale
  onClose: () => void
  onUpdated: (sale: Sale) => void
  onFinalized: () => void
}

function SaleDetailDialog({ sale, onClose, onUpdated, onFinalized }: SaleDetailDialogProps) {
  const api = useApiClient()
  const qc = useQueryClient()
  const { showSuccess } = useToast()
  const isPending = sale.status === "pending"

  const [editItems, setEditItems] = useState<EditableItem[]>([])
  const [editNotes, setEditNotes] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [defaultSellerId, setDefaultSellerId] = useState<string>("")
  const [error, setError] = useState("")

  // Lista de profesionales para selector de vendedor
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
    enabled: isPending,
    staleTime: 60_000,
  })

  // Inicializar al abrir el modal o cuando cambia la venta
  useEffect(() => {
    setEditItems(
      sale.items.map((it) => ({
        existingId: it.id,
        type: it.service_id ? "service" : "product",
        id: (it.service_id || it.product_id) as string,
        name: it.item_name,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        professional_user_id: it.professional_user_id,
        professional_name: it.professional_name,
      }))
    )
    setEditNotes(sale.notes ?? "")
    setError("")
  }, [sale.id, sale.items, sale.notes])

  // Debounce búsqueda productos
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(productSearch), 250)
    return () => clearTimeout(t)
  }, [productSearch])

  const { data: products = [], isFetching } = useQuery({
    queryKey: ["sale-edit-products", debouncedSearch],
    queryFn: () =>
      api.get<Product[]>(
        `/products?limit=20&is_active=true&in_stock=true${
          debouncedSearch ? `&q=${encodeURIComponent(debouncedSearch)}` : ""
        }`
      ),
    enabled: isPending,
    staleTime: 30_000,
  })

  const updateSale = useMutation({
    mutationFn: (data: object) => api.patch<Sale>(`/sales/${sale.id}`, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["sales"] })
      qc.invalidateQueries({ queryKey: ["products"] })
      onUpdated(updated)
      showSuccess("Venta actualizada")
    },
    onError: (e: Error) => setError(e.message),
  })

  // Guarda los cambios pendientes (si hay) y cobra en una sola operación.
  // Así la recepción no tiene que hacer "Guardar" antes de "Cobrar".
  const finalize = useMutation({
    mutationFn: async () => {
      if (editItems.length === 0) {
        throw new Error("La venta debe tener al menos un ítem")
      }
      await api.patch<Sale>(`/sales/${sale.id}`, {
        notes: editNotes || null,
        items: editItems.map((it) => ({
          product_id: it.type === "product" ? it.id : null,
          service_id: it.type === "service" ? it.id : null,
          quantity: it.quantity,
          unit_price: it.unit_price,
          professional_user_id: it.professional_user_id,
        })),
      })
      return await api.post<Sale>(`/sales/${sale.id}/finalize`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] })
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["products-active"] })
      onFinalized()
      showSuccess("Venta cobrada")
    },
    onError: (e: Error) => setError(e.message),
  })

  function addProduct(p: Product) {
    const seller = defaultSellerId ? users.find((u) => u.id === defaultSellerId) ?? null : null
    setEditItems((prev) => {
      const existing = prev.find((i) => i.type === "product" && i.id === p.id)
      if (existing) {
        return prev.map((i) =>
          i.type === "product" && i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          type: "product",
          id: p.id,
          name: p.name,
          quantity: 1,
          unit_price: Number(p.price),
          professional_user_id: seller?.id ?? null,
          professional_name: seller?.full_name ?? null,
        },
      ]
    })
  }

  function updateQty(idx: number, delta: number) {
    setEditItems((prev) =>
      prev
        .map((it, i) => (i === idx ? { ...it, quantity: it.quantity + delta } : it))
        .filter((it) => it.quantity > 0)
    )
  }

  function updatePrice(idx: number, value: string) {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) return
    setEditItems((prev) => prev.map((it, i) => (i === idx ? { ...it, unit_price: num } : it)))
  }

  function removeItem(idx: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleSave() {
    setError("")
    if (editItems.length === 0) {
      setError("La venta debe tener al menos un ítem")
      return
    }
    updateSale.mutate({
      notes: editNotes || null,
      items: editItems.map((it) => ({
        product_id: it.type === "product" ? it.id : null,
        service_id: it.type === "service" ? it.id : null,
        quantity: it.quantity,
        unit_price: it.unit_price,
        professional_user_id: it.professional_user_id,
      })),
    })
  }

  function handleFinalize() {
    setError("")
    // Si hay cambios pendientes, primero guardar y después cobrar
    finalize.mutate()
  }

  const total = editItems.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const availableProducts = products.filter(
    (p) => !editItems.some((i) => i.type === "product" && i.id === p.id)
  )

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Venta ${sale.id.slice(0, 8).toUpperCase()} · ${
        isPending ? "Pendiente de cobro" : sale.status === "completed" ? "Cobrada" : "Cancelada"
      }`}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Fecha: {new Date(sale.created_at).toLocaleString("es")}</p>
          {sale.patient_name && <p>Mascota: {sale.patient_name}</p>}
          {sale.owner_name && <p>Propietario: {sale.owner_name}</p>}
        </div>

        {isPending ? (
          <>
            {/* Items editables */}
            <div>
              <p className="text-sm font-medium mb-2">Ítems</p>
              <div className="rounded-md border divide-y">
                {editItems.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground text-center">
                    Sin ítems. Agregá productos o cancelá la venta.
                  </p>
                ) : (
                  editItems.map((it, idx) => (
                    <div key={`${it.type}-${it.id}-${idx}`} className="px-3 py-2 space-y-1">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs px-1 py-0.5 rounded shrink-0 ${
                            it.type === "service"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {it.type === "service" ? "Servicio" : "Producto"}
                        </span>
                        <span className="flex-1 text-sm truncate">{it.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {it.type === "product" && (
                            <button
                              type="button"
                              onClick={() => updateQty(idx, -1)}
                              className="rounded p-0.5 hover:bg-accent text-muted-foreground"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <span className="w-6 text-center text-sm">{it.quantity}</span>
                          {it.type === "product" && (
                            <button
                              type="button"
                              onClick={() => updateQty(idx, 1)}
                              className="rounded p-0.5 hover:bg-accent text-muted-foreground"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-24 h-7 text-sm text-right"
                          value={it.unit_price}
                          onChange={(e) => updatePrice(idx, e.target.value)}
                        />
                        <span className="w-20 text-right text-sm font-medium shrink-0">
                          {fmt(it.quantity * it.unit_price)}
                        </span>
                        {it.type === "product" ? (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="rounded p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Quitar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <div className="w-5" />
                        )}
                      </div>
                      {/* Sub-línea: vendedor */}
                      <div className="flex items-center gap-2 pl-12 text-xs">
                        <span className="text-muted-foreground">Vendedor:</span>
                        {it.type === "service" ? (
                          <span className="text-foreground">
                            {it.professional_name ?? "Sin asignar"}{" "}
                            <span className="text-muted-foreground">(del profesional asignado)</span>
                          </span>
                        ) : (
                          <select
                            value={it.professional_user_id ?? ""}
                            onChange={(e) => {
                              const userId = e.target.value
                              const u = userId ? users.find((u) => u.id === userId) : null
                              setEditItems((prev) =>
                                prev.map((p, i) =>
                                  i === idx
                                    ? {
                                        ...p,
                                        professional_user_id: u?.id ?? null,
                                        professional_name: u?.full_name ?? null,
                                      }
                                    : p
                                )
                              )
                            }}
                            className="h-7 rounded-md border bg-background px-2 text-xs"
                          >
                            <option value="">Sin asignar</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>{u.full_name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="text-right text-sm font-semibold mt-2 pr-3">
                Total: {fmt(total)}
              </div>
            </div>

            {/* Buscador de productos para agregar */}
            <div>
              <div className="flex items-end justify-between gap-3 mb-2">
                <p className="text-sm font-medium">Agregar productos</p>
                <div className="flex items-center gap-2">
                  <Label htmlFor="default_seller" className="text-xs text-muted-foreground">
                    Vendedor:
                  </Label>
                  <select
                    id="default_seller"
                    value={defaultSellerId}
                    onChange={(e) => setDefaultSellerId(e.target.value)}
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    <option value="">Sin asignar</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nombre, código o categoría..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              <div className="rounded-md border divide-y max-h-40 overflow-y-auto mt-2">
                {isFetching ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground text-center">
                    Buscando...
                  </p>
                ) : availableProducts.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground text-center">
                    {debouncedSearch
                      ? `Sin resultados para "${debouncedSearch}"`
                      : "No hay productos con stock"}
                  </p>
                ) : (
                  availableProducts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 cursor-pointer"
                      onClick={() => addProduct(p)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.category_name && `${p.category_name} · `}
                          {p.sku && `${p.sku} · `}
                          Stock: {p.stock}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-sm text-muted-foreground">{fmt(p.price)}</span>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit_notes">Notas</Label>
              <Input
                id="edit_notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Observaciones de la venta..."
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={updateSale.isPending || finalize.isPending}
              >
                {updateSale.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
              <Button onClick={handleFinalize} disabled={finalize.isPending || updateSale.isPending}>
                <CreditCard className="h-4 w-4" />
                {finalize.isPending ? "Cobrando..." : "Cobrar"}
              </Button>
            </div>
          </>
        ) : (
          <>
            {sale.notes && <p className="text-sm text-muted-foreground">Notas: {sale.notes}</p>}
            <SaleItemsTable items={sale.items} />
            <div className="flex justify-end font-semibold text-sm">Total: {fmt(sale.total)}</div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
