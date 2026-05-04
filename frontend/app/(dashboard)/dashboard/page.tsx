"use client";

import { useCallback, useEffect, useState } from "react";

import { getStoredToken, logout } from "@/lib/auth";
import type { DashboardMetricsResponse } from "@/types/api";

const REFRESH_INTERVAL = 30;
type FetchState = "idle" | "loading" | "refreshing" | "error";

// ── Formatting helpers ─────────────────────────────────────────────────────

function fmt(n: string | number, decimals = 0) {
  return Number(n).toLocaleString("en-ZA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
function fmtCurrency(n: string | number) {
  return `R ${fmt(n, 2)}`;
}

// ── Stat card ──────────────────────────────────────────────────────────────

type Accent = "green" | "blue" | "amber" | "red" | "violet" | "none";

const ACCENT_STYLES: Record<Accent, { bar: string; badge: string }> = {
  green:  { bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  blue:   { bar: "bg-blue-500",   badge: "bg-blue-50   text-blue-700"   },
  amber:  { bar: "bg-amber-400",  badge: "bg-amber-50  text-amber-700"  },
  red:    { bar: "bg-red-500",    badge: "bg-red-50    text-red-700"    },
  violet: { bar: "bg-violet-500", badge: "bg-violet-50 text-violet-700" },
  none:   { bar: "bg-slate-300",  badge: "bg-slate-100 text-slate-600"  },
};

function StatCard({
  label,
  value,
  sub,
  accent = "none",
  badge,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: Accent;
  badge?: string;
}) {
  const a = ACCENT_STYLES[accent];
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className={`absolute left-0 top-0 h-full w-1 ${a.bar}`} />
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
          {badge && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.badge}`}>
              {badge}
            </span>
          )}
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-muted">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
    </div>
  );
}

function AlertRow({ count, label, href }: { count: number; label: string; href?: string }) {
  if (count === 0) return null;
  const inner = (
    <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
      <span className="h-2 w-2 rounded-full bg-red-500" />
      <p className="text-sm text-red-700">
        <strong className="font-semibold">{count}</strong> {label}
      </p>
      {href && <span className="ml-auto text-xs font-medium text-red-600 underline underline-offset-2">View →</span>}
    </div>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

  const fetchMetrics = useCallback(async (trigger: "initial" | "manual" | "auto") => {
    const token = getStoredToken();
    if (!token) { logout(); window.location.replace("/login"); return; }

    setState((prev) => trigger === "initial" && prev === "idle" ? "loading" : "refreshing");
    setError(null);

    try {
      const res = await fetch("/api/dashboard-metrics", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) { logout(); window.location.replace("/login"); return; }
        throw new Error((payload as { detail?: string })?.detail ?? "Unable to load dashboard");
      }
      setMetrics(payload as DashboardMetricsResponse);
      setState("idle");
      setCountdown(REFRESH_INTERVAL);
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Unable to load dashboard");
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void fetchMetrics("initial"), 0);
    return () => window.clearTimeout(t);
  }, [fetchMetrics]);

  useEffect(() => {
    if (!metrics) return;
    const t = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { void fetchMetrics("auto"); return REFRESH_INTERVAL; }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [fetchMetrics, metrics]);

  const loading = state === "loading" && !metrics;
  const ph = (v: string | number) => (loading ? "—" : v);

  const s   = metrics?.sales;
  const l   = metrics?.leads;
  const t   = metrics?.tasks;
  const inv = metrics?.inventory;
  const wf  = metrics?.workflows;

  return (
    <div className="space-y-8">

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-0.5 text-xs text-muted">
            Auto-refreshes every {REFRESH_INTERVAL}s
            {metrics && <> · last updated {new Date(metrics.refreshedAt).toLocaleTimeString()}</>}
            {state !== "loading" && <> · next in <strong className="text-slate-600">{countdown}s</strong></>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchMetrics("manual")}
          disabled={state === "refreshing"}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          {state === "refreshing" ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={() => void fetchMetrics("manual")}
            className="ml-4 rounded border border-red-300 px-2 py-0.5 text-xs hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Alerts ─────────────────────────────────────────────────────── */}
      {!loading && ((t?.overdue ?? 0) > 0 || (inv?.out_of_stock_products ?? 0) > 0 || (wf?.failed_runs_today ?? 0) > 0) && (
        <div className="space-y-2">
          <AlertRow count={t?.overdue ?? 0}                  label="overdue tasks need attention"     href="/tasks" />
          <AlertRow count={inv?.out_of_stock_products ?? 0}  label="products are out of stock"        href="/inventory" />
          <AlertRow count={wf?.failed_runs_today ?? 0}       label="workflow failures today"          href="/runs" />
        </div>
      )}

      {/* ── Sales ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeader title="Sales" icon="💰" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Total Revenue"      value={ph(fmtCurrency(s?.revenue_total ?? 0))}       accent="green" />
          <StatCard label="Revenue This Month" value={ph(fmtCurrency(s?.revenue_this_month ?? 0))}  accent="green" />
          <StatCard
            label="Open Orders"
            value={ph(fmt(s?.open_orders ?? 0))}
            sub="draft · confirmed · processing"
            accent="blue"
            badge={s?.open_orders ? String(s.open_orders) : undefined}
          />
          <StatCard label="Total Orders" value={ph(fmt(s?.orders_total ?? 0))} />
        </div>
      </div>

      {/* ── Leads & Tasks ──────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <SectionHeader title="Leads" icon="👥" />
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Open Leads"  value={ph(fmt(l?.open_leads ?? 0))}      accent="blue"  badge={l?.open_leads ? String(l.open_leads) : undefined} />
            <StatCard label="New"         value={ph(fmt(l?.new_leads ?? 0))}        accent="violet" />
            <StatCard label="Qualified"   value={ph(fmt(l?.qualified_leads ?? 0))}  />
            <StatCard label="Won"         value={ph(fmt(l?.won_leads ?? 0))}        accent="green" />
          </div>
        </div>

        <div className="space-y-3">
          <SectionHeader title="Tasks" icon="✅" />
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Overdue"
              value={ph(fmt(t?.overdue ?? 0))}
              accent={(t?.overdue ?? 0) > 0 ? "red" : "none"}
              badge={(t?.overdue ?? 0) > 0 ? "!" : undefined}
            />
            <StatCard
              label="Due Today"
              value={ph(fmt(t?.due_today ?? 0))}
              accent={(t?.due_today ?? 0) > 0 ? "amber" : "none"}
            />
            <StatCard label="Pending" value={ph(fmt(t?.pending ?? 0))} />
          </div>
        </div>
      </div>

      {/* ── Inventory & Workflows ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <SectionHeader title="Inventory" icon="📦" />
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Low Stock"
              value={ph(fmt(inv?.low_stock_products ?? 0))}
              accent={(inv?.low_stock_products ?? 0) > 0 ? "amber" : "none"}
              badge={(inv?.low_stock_products ?? 0) > 0 ? "Low" : undefined}
            />
            <StatCard
              label="Out of Stock"
              value={ph(fmt(inv?.out_of_stock_products ?? 0))}
              accent={(inv?.out_of_stock_products ?? 0) > 0 ? "red" : "none"}
              badge={(inv?.out_of_stock_products ?? 0) > 0 ? "!" : undefined}
            />
            <StatCard label="Active Products"  value={ph(fmt(inv?.total_active_products ?? 0))} />
            <StatCard label="Active Suppliers" value={ph(fmt(inv?.total_suppliers ?? 0))} />
          </div>
        </div>

        <div className="space-y-3">
          <SectionHeader title="Workflows" icon="⚡" />
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Definitions" value={ph(fmt(wf?.total_definitions ?? 0))} />
            <StatCard
              label="Active Runs"
              value={ph(fmt(wf?.active_runs ?? 0))}
              accent={(wf?.active_runs ?? 0) > 0 ? "blue" : "none"}
            />
            <StatCard
              label="Failures Today"
              value={ph(fmt(wf?.failed_runs_today ?? 0))}
              accent={(wf?.failed_runs_today ?? 0) > 0 ? "red" : "none"}
              badge={(wf?.failed_runs_today ?? 0) > 0 ? "!" : undefined}
            />
          </div>
        </div>
      </div>

    </div>
  );
}
