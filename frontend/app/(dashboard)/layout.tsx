"use client";

import { useState } from "react";

import { AuthGuard } from "@/components/AuthGuard";
import { RoleMenu } from "@/components/RoleMenu";
import { logout } from "@/lib/auth";
import type { CurrentUser } from "@/types/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<CurrentUser | null>(null);

  function handleLogout() {
    logout();
    window.location.replace("/login");
  }

  return (
    <AuthGuard onUserLoaded={setUser}>
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen w-full max-w-[1400px]">
          <aside className="w-64 border-r border-border bg-surface p-4">
            <h2 className="text-lg font-semibold text-slate-900">BiznizFlowPilot</h2>
            <p className="mt-1 text-xs text-muted">Operational Dashboard</p>

            <div className="mt-6">
              <RoleMenu role={user?.role ?? "staff"} />
            </div>

            <div className="mt-8 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-semibold">{user?.full_name ?? "Loading..."}</p>
              <p className="mt-1">{user?.email ?? ""}</p>
              <p className="mt-1 capitalize">Role: {user?.role ?? "..."}</p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 w-full rounded-md border border-border px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Logout
            </button>
          </aside>

          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
