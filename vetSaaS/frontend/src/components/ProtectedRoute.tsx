import { Navigate } from "react-router-dom"
import { usePermissions } from "@/hooks/usePermissions"

interface Props {
  requires?: string | string[]
  children: React.ReactNode
}

// Bloquea el render hasta que cargan los permisos. Si el usuario no tiene
// ninguno de los permisos requeridos, redirige al dashboard.
export function ProtectedRoute({ requires, children }: Props) {
  const { isLoading, canAny } = usePermissions()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (!requires) return <>{children}</>

  const actions = Array.isArray(requires) ? requires : [requires]
  if (!canAny(actions)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
