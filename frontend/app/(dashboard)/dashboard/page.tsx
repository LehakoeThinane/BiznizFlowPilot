"use client";

import { useCallback, useEffect, useState } from "react";

import { getStoredToken, logout } from "@/lib/auth";
import type { DashboardMetricsResponse } from "@/types/api";

const REFRESH_INTERVAL = 30;

type FetchState = "idle" | "loading" | "refreshing" | "error";

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "red" | "yellow" | "green" | "blue";
}) {
  const accentClass =
    accent === "red"
      ? "border-l-4 border-red-400"
      : accent === "yellow"
        ? "border-l-4 border-yellow-400"
        : accent === "green"
          ? "border-l-4 border-green-400"
          : accent === "blue"
            ? "border-l-4 border-blue-400"
            : "";

  return (
    <div
      className={`rounded-xl border border-border bg-surface p-4 shadow-sm ${accentClass}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
      {children}
    </h2>
  );
}

function AlertBadge({ count, label }: { count: number; label: string }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <span className="h-2 w-2 rounded-full bg-red-500" />
      <span>
        <strong>{count}</strong> {label}
      </span>
    </div>
  );
}

function fmt(n: string | number, decimals = 0): string {
  return Number(n).toLocaleString("en-ZA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCurrency(n: string | number): string {
  return `R ${fmt(n, 2)}`;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

  const fetchMetrics = useCallback(
    async (trigger: "initial" | "manual" | "auto") => {
      const token = getStoredToken();
      if (!token) {
        logout();
        window.location.replace("/login");
        return;
      }

      setState((prev) =>
        trigger === "initial" && prev === "idle" ? "loading" : "refreshing",
      );
      setError(null);

      try {
        const res = await fetch("/api/dashboard-metrics", {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          cache: "no-store",
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          if (res.status === 401) {
            logout();
            window.location.replace("/login");
            return;
          }
          throw new Error(
            (payload as { detail?: string })?.detail ?? "Unable to load dashboard",
          );
        }
        setMetrics(payload as DashboardMetricsResponse);
        setState("idle");
        setCountdown(REFRESH_INTERVAL);
      } catch (e) {
        setState("error");
        setError(e instanceof Error ? e.message : "Unable to load dashboard");
      }
    },
    [],
  );

  useEffect(() => {
    const t = window.setTimeout(() => void fetchMetrics("initial"), 0);
    return () => window.clearTimeout(t);
  }, [fetchMetrics]);

  useEffect(() => {
    if (!metrics) return;
    const t = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void fetchMetrics("auto");
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [fetchMetrics, metrics]);

  const loading = state === "loading" && !metrics;
  const ph = loading ? "—" : undefined;

  const s = metrics?.sales;
  const l = metrics?.leads;
  const t = metrics?.tasks;
  const inv = metrics?.inventory;
  const wf = metrics?.workflows;

  const hasAlerts =
    (t?.overdue ?? 0) > 0 ||
    (inv?.out_of_stock_products ?? 0) > 0 ||
    (wf?.failed_runs_today ?? 0) > 0;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-xs text-muted">
            Refreshes every {REFRESH_INTERVAL}s · next in{" "}
            <span className="font-semibold text-slate-700">{countdown}s</span>
            {metrics && (
              <>
                {" · "}last updated{" "}
                {new Date(metrics.refreshedAt).toLocaleTimeString()}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchMetrics("manual")}
          disabled={state === "refreshing"}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {state === "refreshing" ? "Refreshing…" : "Refresh now"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void fetchMetrics("manual")}
            className="mt-2 rounded-md border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* Alerts */}
      {hasAlerts && (
        <div className="flex flex-wrap gap-2">
          <AlertBadge count={t?.overdue ?? 0} label="overdue tasks" />
          <AlertBadge
            count={inv?.out_of_stock_products ?? 0}
            label="out-of-stock products"
          />
          <AlertBadge
            count={wf?.failed_runs_today ?? 0}
            label="workflow failures today"
          />
        </div>
      )}

      {/* Sales */}
      <div className="space-y-2">
        <SectionHeading>Sales</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Revenue"
            value={ph ?? fmtCurrency(s?.revenue_total ?? 0)}
            accent="green"
          />
          <StatCard
            label="Revenue This Month"
            value={ph ?? fmtCurrency(s?.revenue_this_month ?? 0)}
            accent="green"
          />
          <StatCard
            label="Open Orders"
            value={ph ?? fmt(s?.open_orders ?? 0)}
            sub="draft · confirmed · processing"
            accent="blue"
          />
          <StatCard
            label="Total Orders"
            value={ph ?? fmt(s?.orders_total ?? 0)}
          />
        </div>
      </div>

      {/* Leads & Tasks */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <SectionHeading>Leads</SectionHeading>
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Open Leads"
              value={ph ?? fmt(l?.open_leads ?? 0)}
              accent="blue"
            />
            <StatCard label="New" value={ph ?? fmt(l?.new_leads ?? 0)} />
            <StatCard
              label="Qualified"
              value={ph ?? fmt(l?.qualified_leads ?? 0)}
            />
            <StatCard
              label="Won"
              value={ph ?? fmt(l?.won_leads ?? 0)}
              accent="green"
            />
          </div>
        </div>

        <div className="space-y-2">
          <SectionHeading>Tasks</SectionHeading>
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Overdue"
              value={ph ?? fmt(t?.overdue ?? 0)}
              accent={(t?.overdue ?? 0) > 0 ? "red" : undefined}
            />
            <StatCard
              label="Due Today"
              value={ph ?? fmt(t?.due_today ?? 0)}
              accent={(t?.due_today ?? 0) > 0 ? "yellow" : undefined}
            />
            <StatCard label="Pending" value={ph ?? fmt(t?.pending ?? 0)} />
          </div>
        </div>
      </div>

      {/* Inventory & Workflows */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <SectionHeading>Inventory</SectionHeading>
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Low Stock"
              value={ph ?? fmt(inv?.low_stock_products ?? 0)}
              accent={(inv?.low_stock_products ?? 0) > 0 ? "yellow" : undefined}
            />
            <StatCard
              label="Out of Stock"
              value={ph ?? fmt(inv?.out_of_stock_products ?? 0)}
              accent={
                (inv?.out_of_stock_products ?? 0) > 0 ? "red" : undefined
              }
            />
            <StatCard
              label="Active Products"
              value={ph ?? fmt(inv?.total_active_products ?? 0)}
            />
            <StatCard
              label="Active Suppliers"
              value={ph ?? fmt(inv?.total_suppliers ?? 0)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <SectionHeading>Workflows</SectionHeading>
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Definitions"
              value={ph ?? fmt(wf?.total_definitions ?? 0)}
            />
            <StatCard
              label="Active Runs"
              value={ph ?? fmt(wf?.active_runs ?? 0)}
              accent={(wf?.active_runs ?? 0) > 0 ? "blue" : undefined}
            />
            <StatCard
              label="Failures Today"
              value={ph ?? fmt(wf?.failed_runs_today ?? 0)}
              accent={(wf?.failed_runs_today ?? 0) > 0 ? "red" : undefined}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
