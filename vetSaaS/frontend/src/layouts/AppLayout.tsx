import { UserButton } from "@clerk/clerk-react"
import {
  BarChart3,
  Calendar,
  ClipboardList,
  Cog,
  LayoutDashboard,
  Package,
  PawPrint,
  ShoppingCart,
  Stethoscope,
  Users,
} from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/owners", icon: Users, label: "Propietarios" },
  { to: "/patients", icon: PawPrint, label: "Mascotas" },
  { to: "/appointments", icon: Calendar, label: "Citas" },
  { to: "/medical-records", icon: Stethoscope, label: "Historia Clínica" },
  { to: "/products", icon: Package, label: "Inventario" },
  { to: "/sales", icon: ShoppingCart, label: "Ventas" },
  { to: "/reports", icon: BarChart3, label: "Reportes" },
  { to: "/configuration", icon: Cog, label: "Configuración" },
]

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-60 flex-col border-r bg-card">
        <div className="flex h-16 items-center border-b px-6">
          <span className="flex items-center gap-2 font-semibold text-primary">
            <ClipboardList className="h-5 w-5" />
            VetSaaS
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3 border-t px-4 py-4">
          <UserButton />
          <span className="text-sm text-muted-foreground">Mi cuenta</span>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-background p-6">
        <Outlet />
      </main>
    </div>
  )
}
