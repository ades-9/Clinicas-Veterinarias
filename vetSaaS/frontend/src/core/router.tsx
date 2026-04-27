import { SignIn, SignUp, useAuth } from "@clerk/clerk-react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import { DashboardLayout } from "../layouts/DashboardLayout";

function ProtectedRoute() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    path: "/sign-in/*",
    element: (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <SignIn routing="path" path="/sign-in" />
      </div>
    ),
  },
  {
    path: "/sign-up/*",
    element: (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <SignUp routing="path" path="/sign-up" />
      </div>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: "/", element: <Navigate to="/dashboard" replace /> },
          {
            path: "/dashboard",
            element: (
              <div className="p-8">
                <h1 className="text-2xl font-bold">Bienvenido a VetSaaS</h1>
              </div>
            ),
          },
        ],
      },
    ],
  },
]);
