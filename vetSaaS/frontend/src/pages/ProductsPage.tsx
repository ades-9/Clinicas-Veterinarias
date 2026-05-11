import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Package, Pencil, Plus, Search, Trash2, TrendingDown, TrendingUp } from "lucide-react"
import { useState } from "react"
import { useApiClient } from "@/api/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import type { Product, ProductCategory, ProductUnit, StockMovement } from "@/types"

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}

// ── forms ─────────────────────────────────────────────────────────────────────

interface ProductForm {
  name: string
  category_id: string
  sku: string
  unit: string
  price: string
  cost: string
  min_stock: string
  description: string
  is_medication: boolean
}

const EMPTY_PRODUCT: ProductForm = {
  name: "", category_id: "", sku: "", unit: "unidad",
  price: "", cost: "", min_stock: "0", description: "",
  is_medication: false,
}

interface MovementForm {
  movement_type: "entry" | "exit" | "adjustment"
  quantity: string
  reason: string
}

const EMPTY_MOVEMENT: MovementForm = { movement_type: "entry", quantity: "", reason: "" }

// ── component ─────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const api = useApiClient()
  const qc = useQueryClient()

  const [search, setSearch] = useState("")
  const [lowStock, setLowStock] = useState(false)
  const [tab, setTab] = useState<"products" | "movements">("products")

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(EMPTY_PRODUCT)
  const [formError, setFormError] = useState("")

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleteError, setDeleteError] = useState("")

  const [movOpen, setMovOpen] = useState(false)
  const [movProduct, setMovProduct] = useState<Product | null>(null)
  const [movForm, setMovForm] = useState<MovementForm>(EMPTY_MOVEMENT)
  const [movError, setMovError] = useState("")

  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: () => api.get<ProductCategory[]>("/product-categories"),
  })

  const { data: units = [] } = useQuery({
    queryKey: ["catalog-units"],
    queryFn: () => api.get<ProductUnit[]>("/catalog/product-units"),
    staleTime: Infinity,
  })

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", search, lowStock],
    queryFn: () =>
      api.get<Product[]>(`/products?q=${encodeURIComponent(search)}&low_stock=${lowStock}&limit=200`),
  })

  const { data: movements = [], isLoading: loadingMov } = useQuery({
    queryKey: ["stock-movements"],
    queryFn: () => api.get<StockMovement[]>("/stock-movements?limit=100"),
    enabled: tab === "movements",
  })

  const createProduct = useMutation({
    mutationFn: (d: object) => api.post<Product>("/products", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); closeForm() },
    onError: (e: Error) => setFormError(e.message),
  })

  const updateProduct = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.patch<Product>(`/products/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); closeForm() },
    onError: (e: Error) => setFormError(e.message),
  })

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.del(`/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setDeleteTarget(null) },
    onError: (e: Error) => setDeleteError(e.message),
  })

  const createMovement = useMutation({
    mutationFn: (d: object) => api.post<StockMovement>("/stock-movements", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["stock-movements"] })
      setMovOpen(false)
      setMovProduct(null)
      setMovForm(EMPTY_MOVEMENT)
      setMovError("")
    },
    onError: (e: Error) => setMovError(e.message),
  })

  function openCreate() {
    setEditing(null); setForm(EMPTY_PRODUCT); setFormError(""); setFormOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name, category_id: p.category_id ?? "",
      sku: p.sku ?? "", unit: p.unit,
      price: String(p.price), cost: p.cost != null ? String(p.cost) : "",
      min_stock: String(p.min_stock), description: p.description ?? "",
      is_medication: p.is_medication,
    })
    setFormError(""); setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false); setEditing(null); setForm(EMPTY_PRODUCT); setFormError("")
  }

  function handleProductSubmit(e: React.FormEvent) {
    e.preventDefault(); setFormError("")
    const payload = {
      name: form.name,
      category_id: form.category_id || null,
      sku: form.sku || null,
      unit: form.unit,
      price: parseFloat(form.price),
      cost: form.cost ? parseFloat(form.cost) : null,
      min_stock: parseFloat(form.min_stock) || 0,
      description: form.description || null,
      is_medication: form.is_medication,
    }
    if (editing) updateProduct.mutate({ id: editing.id, d: payload })
    else createProduct.mutate(payload)
  }

  function openMovement(p: Product) {
    setMovProduct(p); setMovForm(EMPTY_MOVEMENT); setMovError(""); setMovOpen(true)
  }

  function handleMovementSubmit(e: React.FormEvent) {
    e.preventDefault(); setMovError("")
    if (!movProduct) return
    createMovement.mutate({
      product_id: movProduct.id,
      movement_type: movForm.movement_type,
      quantity: parseFloat(movForm.quantity),
      reason: movForm.reason || null,
    })
  }

  const isSaving = createProduct.isPending || updateProduct.isPending

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-sm text-muted-foreground">Productos y movimientos de stock</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      {/* tabs */}
      <div className="flex gap-2 border-b">
        {(["products", "movements"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "products" ? "Productos" : "Movimientos"}
          </button>
        ))}
      </div>

      {tab === "products" && (
        <>
          {/* filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre o SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setLowStock((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
                lowStock ? "bg-destructive/10 border-destructive/30 text-destructive" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              Stock bajo
            </button>
          </div>

          {/* table */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Producto</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">SKU</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Categoría</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Precio</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Stock</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Cargando...</td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      {search || lowStock ? "Sin resultados" : "No hay productos registrados"}
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{p.name}</span>
                        </div>
                        {p.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 ml-6">{p.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.sku ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.category_name ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmt(p.price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={p.stock <= p.min_stock ? "text-destructive font-semibold" : ""}>
                          {p.stock} {p.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={p.is_active ? "success" : "secondary"}>
                          {p.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openMovement(p)}
                            className="rounded p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            title="Movimiento de stock"
                          >
                            <TrendingUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEdit(p)}
                            className="rounded p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => { setDeleteError(""); setDeleteTarget(p) }}
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
        </>
      )}

      {tab === "movements" && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cantidad</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Razón</th>
              </tr>
            </thead>
            <tbody>
              {loadingMov ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Cargando...</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Sin movimientos</td></tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 font-medium">{m.product_name}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1">
                        {m.movement_type === "entry" ? (
                          <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                        )}
                        <span className={m.movement_type === "entry" ? "text-green-700" : m.movement_type === "exit" ? "text-red-700" : ""}>
                          {m.movement_type === "entry" ? "Entrada" : m.movement_type === "exit" ? "Salida" : "Ajuste"}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{m.quantity}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.reason ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal producto */}
      <Dialog open={formOpen} onClose={closeForm} title={editing ? "Editar producto" : "Nuevo producto"}>
        <form onSubmit={handleProductSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="p-name">Nombre *</Label>
              <Input id="p-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-sku">SKU</Label>
              <Input id="p-sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-unit">Unidad</Label>
              <Select id="p-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                <option value="">Seleccionar...</option>
                {units.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-price">Precio *</Label>
              <Input id="p-price" type="number" min="0" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-cost">Costo</Label>
              <Input id="p-cost" type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-min">Stock mínimo</Label>
              <Input id="p-min" type="number" min="0" step="0.01" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-cat">Categoría</Label>
              <Select
                id="p-cat"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="p-desc">Descripción</Label>
              <Input id="p-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_medication}
                  onChange={(e) => setForm({ ...form, is_medication: e.target.checked })}
                />
                <span className="text-sm">
                  Es medicamento
                  <span className="text-xs text-muted-foreground ml-1.5">
                    (aparece en el selector de prescripciones del expediente)
                  </span>
                </span>
              </label>
            </div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : editing ? "Guardar cambios" : "Crear producto"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal movimiento */}
      <Dialog open={movOpen} onClose={() => setMovOpen(false)} title={`Movimiento — ${movProduct?.name}`}>
        <form onSubmit={handleMovementSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de movimiento</Label>
            <Select
              value={movForm.movement_type}
              onChange={(e) => setMovForm({ ...movForm, movement_type: e.target.value as MovementForm["movement_type"] })}
            >
              <option value="entry">Entrada</option>
              <option value="exit">Salida</option>
              <option value="adjustment">Ajuste</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-qty">Cantidad *</Label>
            <Input id="mov-qty" type="number" min="0.01" step="0.01" required value={movForm.quantity} onChange={(e) => setMovForm({ ...movForm, quantity: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-reason">Razón</Label>
            <Input id="mov-reason" value={movForm.reason} onChange={(e) => setMovForm({ ...movForm, reason: e.target.value })} />
          </div>
          {movError && <p className="text-sm text-destructive">{movError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setMovOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={createMovement.isPending}>
              {createMovement.isPending ? "Registrando..." : "Registrar"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Eliminar producto">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Eliminar <span className="font-medium text-foreground">{deleteTarget?.name}</span>? Esta acción no se puede deshacer.
          </p>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteProduct.isPending}
              onClick={() => deleteTarget && deleteProduct.mutate(deleteTarget.id)}
            >
              {deleteProduct.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
