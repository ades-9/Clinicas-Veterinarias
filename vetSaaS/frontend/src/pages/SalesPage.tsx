import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react"
import { useState } from "react"
import { useApiClient } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Owner, Patient, Product, Sale, SaleItem } from "@/types"

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("es", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n)
}

// ── cart ──────────────────────────────────────────────────────────────────────

interface CartItem {
  product: Product
  quantity: number
  unit_price: number
}

// ── component ─────────────────────────────────────────────────────────────────

export function SalesPage() {
  const api = useApiClient()
  const qc = useQueryClient()

  const [newSaleOpen, setNewSaleOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [patientId, setPatientId] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [notes, setNotes] = useState("")
  const [saleError, setSaleError] = useState("")

  const [detailSale, setDetailSale] = useState<Sale | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null)
  const [deleteError, setDeleteError] = useState("")

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: () => api.get<Sale[]>("/sales?limit=100"),
  })

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: () => api.get<Product[]>("/products?limit=200"),
    enabled: newSaleOpen,
  })

  const { data: owners = [] } = useQuery({
    queryKey: ["owners-all"],
    queryFn: () => api.get<Owner[]>("/owners?limit=200"),
    enabled: newSaleOpen,
  })

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-all"],
    queryFn: () => api.get<Patient[]>("/patients?limit=200"),
    enabled: newSaleOpen,
  })

  const createSale = useMutation({
    mutationFn: (d: object) => api.post<Sale>("/sales", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] })
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["products-active"] })
      closeNewSale()
    },
    onError: (e: Error) => setSaleError(e.message),
  })

  const deleteSale = useMutation({
    mutationFn: (id: string) => api.del(`/sales/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales"] }); setDeleteTarget(null) },
    onError: (e: Error) => setDeleteError(e.message),
  })

  function closeNewSale() {
    setNewSaleOpen(false)
    setCart([])
    setPatientId("")
    setOwnerId("")
    setNotes("")
    setSaleError("")
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { product, quantity: 1, unit_price: product.price }]
    })
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId))
    } else {
      setCart((prev) => prev.map((i) => i.product.id === productId ? { ...i, quantity: qty } : i))
    }
  }

  function updatePrice(productId: string, price: number) {
    setCart((prev) => prev.map((i) => i.product.id === productId ? { ...i, unit_price: price } : i))
  }

  const cartTotal = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0)

  function handleCreateSale(e: React.FormEvent) {
    e.preventDefault()
    setSaleError("")
    if (cart.length === 0) { setSaleError("Agrega al menos un producto"); return }
    createSale.mutate({
      patient_id: patientId || null,
      owner_id: ownerId || null,
      notes: notes || null,
      items: cart.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    })
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ventas</h1>
          <p className="text-sm text-muted-foreground">Registro de ventas de productos</p>
        </div>
        <Button onClick={() => setNewSaleOpen(true)}>
          <ShoppingCart className="h-4 w-4" />
          Nueva venta
        </Button>
      </div>

      {/* tabla de ventas */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Paciente</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Propietario</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Ítems</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Cargando...</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No hay ventas registradas</td></tr>
            ) : (
              sales.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">{s.patient_name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.owner_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(s.total)}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{s.items.length}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setDetailSale(s)}
                        className="rounded px-2 py-1 text-xs hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Ver
                      </button>
                      <button
                        onClick={() => { setDeleteError(""); setDeleteTarget(s) }}
                        className="rounded p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Anular"
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

      {/* Modal nueva venta */}
      <Dialog open={newSaleOpen} onClose={closeNewSale} title="Nueva venta">
        <form onSubmit={handleCreateSale} className="space-y-5">
          {/* cliente opcional */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-owner">Propietario</Label>
              <select
                id="s-owner"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                <option value="">Sin propietario</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>{o.full_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-patient">Paciente</Label>
              <select
                id="s-patient"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              >
                <option value="">Sin paciente</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.owner_name})</option>
                ))}
              </select>
            </div>
          </div>

          {/* productos disponibles */}
          <div className="space-y-2">
            <Label>Agregar productos</Label>
            <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
              {products.filter((p) => p.is_active && p.stock > 0).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                >
                  <span>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground ml-2">Stock: {p.stock}</span>
                  </span>
                  <span className="text-muted-foreground">{fmt(p.price)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* carrito */}
          {cart.length > 0 && (
            <div className="space-y-2">
              <Label>Carrito</Label>
              <div className="rounded-md border divide-y">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="flex-1 text-sm font-medium truncate">{item.product.name}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateQty(item.product.id, item.quantity - 1)}>
                        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button type="button" onClick={() => updateQty(item.product.id, item.quantity + 1)}>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-28 text-right"
                      value={item.unit_price}
                      onChange={(e) => updatePrice(item.product.id, parseFloat(e.target.value) || 0)}
                    />
                    <button type="button" onClick={() => updateQty(item.product.id, 0)}>
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

          {/* notas */}
          <div className="space-y-1.5">
            <Label htmlFor="s-notes">Notas</Label>
            <Input id="s-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {saleError && <p className="text-sm text-destructive">{saleError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeNewSale}>Cancelar</Button>
            <Button type="submit" disabled={createSale.isPending || cart.length === 0}>
              {createSale.isPending ? "Procesando..." : `Confirmar ${cart.length > 0 ? fmt(cartTotal) : ""}`}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Detalle venta */}
      {detailSale && (
        <Dialog open onClose={() => setDetailSale(null)} title={`Venta ${detailSale.id.slice(0, 8).toUpperCase()}`}>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Fecha: {new Date(detailSale.created_at).toLocaleString("es")}</p>
              {detailSale.patient_name && <p>Paciente: {detailSale.patient_name}</p>}
              {detailSale.owner_name && <p>Propietario: {detailSale.owner_name}</p>}
              {detailSale.notes && <p>Notas: {detailSale.notes}</p>}
            </div>
            <SaleItemsTable items={detailSale.items} />
            <div className="flex justify-end font-semibold text-sm">
              Total: {fmt(detailSale.total)}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setDetailSale(null)}>Cerrar</Button>
            </div>
          </div>
        </Dialog>
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
          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Producto</th>
          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cant.</th>
          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Precio u.</th>
          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-b last:border-0">
            <td className="px-3 py-2">{item.product_name}</td>
            <td className="px-3 py-2 text-right">{item.quantity}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">
              {new Intl.NumberFormat("es", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(item.unit_price)}
            </td>
            <td className="px-3 py-2 text-right font-medium">
              {new Intl.NumberFormat("es", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(item.subtotal)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
