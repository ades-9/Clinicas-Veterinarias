import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react"
import { Navigate, Route, Routes } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
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
        <Route
          path="/owners"
          element={
            <ProtectedRoute requires="owners.view">
              <OwnersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients"
          element={
            <ProtectedRoute requires="patients.view">
              <PatientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:id"
          element={
            <ProtectedRoute requires="patients.view">
              <PatientDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointments"
          element={
            <ProtectedRoute requires={["appointments.view_all", "appointments.view_own"]}>
              <AppointmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/medical-records"
          element={
            <ProtectedRoute requires="medical_records.view">
              <MedicalRecordsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute requires="products.view">
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales"
          element={
            <ProtectedRoute requires="sales.view">
              <SalesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute requires={["reports.view_general", "reports.view_own"]}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/configuration"
          element={
            <ProtectedRoute requires="configuration.view">
              <ConfigurationPage />
            </ProtectedRoute>
          }
        />
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
