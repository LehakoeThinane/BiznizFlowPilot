"use client";

import { useState } from "react";

import { AuthGuard } from "@/components/AuthGuard";
import { ChatPanel } from "@/components/ChatPanel";
import { RoleMenu } from "@/components/RoleMenu";
import { logout } from "@/lib/auth";
import type { CurrentUser } from "@/types/api";

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
      {initials || "?"}
    </span>
  );
}

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
      <div className="flex h-screen overflow-hidden">

        {/* ── Dark sidebar ─────────────────────────────────────────────── */}
        <aside className="sidebar flex w-56 shrink-0 flex-col overflow-y-auto">

          {/* Logo strip */}
          <div className="sidebar-divider flex items-center gap-3 border-b px-4 py-4.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-xs font-black text-white">
              BF
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-white">BiznizFlow</p>
              <p className="sidebar-label truncate text-[10px]">Pilot</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <RoleMenu role={user?.role ?? "staff"} />
          </nav>

          {/* User strip */}
          <div className="sidebar-divider border-t px-3 pb-4 pt-3">
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
              <UserAvatar name={user?.full_name ?? "?"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">
                  {user?.full_name ?? "Loading…"}
                </p>
                <p className="sidebar-label truncate text-[10px] capitalize">
                  {user?.role ?? ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="sidebar-item mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
            >
              <svg
                className="h-3.5 w-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                />
              </svg>
              Sign out
            </button>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
            <div />
            <span className="text-xs text-muted">{user?.email ?? ""}</span>
          </header>
          <main className="flex-1 overflow-y-auto bg-background p-6">
            {children}
          </main>
        </div>
      </div>

      <ChatPanel />
    </AuthGuard>
  );
}
