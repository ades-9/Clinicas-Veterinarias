import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react"
import { Navigate, Route, Routes } from "react-router-dom"
import { useOnboarding } from "@/hooks/useOnboarding"
import { AppLayout } from "@/layouts/AppLayout"
import { AppointmentsPage } from "@/pages/AppointmentsPage"
import { ConfigurationPage } from "@/pages/ConfigurationPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { MedicalRecordsPage } from "@/pages/MedicalRecordsPage"
import { OnboardingPage } from "@/pages/OnboardingPage"
import { OwnersPage } from "@/pages/OwnersPage"
import { PatientCarnetPage } from "@/pages/PatientCarnetPage"
import { PatientDetailPage } from "@/pages/PatientDetailPage"
import { PatientsPage } from "@/pages/PatientsPage"
import { ProductsPage } from "@/pages/ProductsPage"
import { ReportsPage } from "@/pages/ReportsPage"
import { SalesPage } from "@/pages/SalesPage"

function AuthenticatedApp() {
  const { isOnboarded, isLoading } = useOnboarding()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (!isOnboarded) {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/owners" element={<OwnersPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/medical-records" element={<MedicalRecordsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/configuration" element={<ConfigurationPage />} />
      </Route>
      {/* Ruta fuera del AppLayout: sin menú lateral, optimizada para imprimir */}
      <Route path="/patients/:id/carnet" element={<PatientCarnetPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <>
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}
