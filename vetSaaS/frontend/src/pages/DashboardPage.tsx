import { useUser } from "@clerk/clerk-react"

export function DashboardPage() {
  const { user } = useUser()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">
        Bienvenido, {user?.firstName ?? "usuario"}
      </p>
    </div>
  )
}
