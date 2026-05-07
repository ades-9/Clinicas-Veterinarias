import { useUser } from "@clerk/clerk-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useApiClient } from "@/api/client"

export function OnboardingPage() {
  const { user } = useUser()
  const api = useApiClient()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    clinic_name: "",
    full_name: user?.fullName ?? "",
    email: user?.primaryEmailAddress?.emailAddress ?? "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.post("/register", form)
      await user?.reload()
      navigate("/dashboard", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Bienvenido a VetSaaS</h1>
          <p className="mt-1 text-muted-foreground">
            Completa los datos de tu clínica para comenzar
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-6">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nombre de la clínica</label>
            <input
              required
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.clinic_name}
              onChange={(e) => setForm((f) => ({ ...f, clinic_name: e.target.value }))}
              placeholder="Clínica Veterinaria..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Tu nombre completo</label>
            <input
              required
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              required
              type="email"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Registrando..." : "Crear clínica"}
          </button>
        </form>
      </div>
    </div>
  )
}
