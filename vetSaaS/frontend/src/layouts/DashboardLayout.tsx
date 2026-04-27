import { UserButton } from "@clerk/clerk-react";
import { Outlet } from "react-router-dom";

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-slate-800 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-slate-700">VetSaaS</div>
        <nav className="flex-1 p-4 space-y-1">
          <a href="/dashboard" className="block rounded px-3 py-2 hover:bg-slate-700">
            Dashboard
          </a>
        </nav>
        <div className="p-4 border-t border-slate-700">
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
