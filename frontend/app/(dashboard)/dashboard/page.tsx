"use client";

import { useCallback, useEffect, useState } from "react";

import { MetricsCard } from "@/components/MetricsCard";
import { getStoredToken, logout } from "@/lib/auth";
import type { DashboardMetricsResponse } from "@/types/api";

const REFRESH_INTERVAL_SECONDS = 30;

type FetchState = "idle" | "loading" | "refreshing" | "error";

export default function DashboardMetricsPage() {
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(
    REFRESH_INTERVAL_SECONDS,
  );

  const fetchMetrics = useCallback(
    async (trigger: "initial" | "manual" | "auto") => {
      const token = getStoredToken();
      if (!token) {
        logout();
        window.location.replace("/login");
        return;
      }

      setState((previous) => {
        if (trigger === "initial" && previous === "idle") {
          return "loading";
        }
        return "refreshing";
      });
      setError(null);

      try {
        const response = await fetch("/api/dashboard-metrics", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | DashboardMetricsResponse
          | { detail?: string }
          | null;

        if (!response.ok) {
          if (response.status === 401) {
            logout();
            window.location.replace("/login");
            return;
          }
          throw new Error(
            payload && typeof payload === "object" && "detail" in payload
              ? String(payload.detail)
              : "Unable to load dashboard metrics",
          );
        }

        setMetrics(payload as DashboardMetricsResponse);
        setState("idle");
        setSecondsUntilRefresh(REFRESH_INTERVAL_SECONDS);
      } catch (requestError) {
        setState("error");
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load dashboard metrics",
        );
      }
    },
    [],
  );

  useEffect(() => {
    const initialFetch = window.setTimeout(() => {
      void fetchMetrics("initial");
    }, 0);
    return () => {
      window.clearTimeout(initialFetch);
    };
  }, [fetchMetrics]);

  useEffect(() => {
    if (!metrics) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsUntilRefresh((previous) => {
        if (previous <= 1) {
          void fetchMetrics("auto");
          return REFRESH_INTERVAL_SECONDS;
        }
        return previous - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [fetchMetrics, metrics]);

  const lastUpdatedDisplay = metrics?.refreshedAt
    ? new Date(metrics.refreshedAt).toLocaleTimeString()
    : "Not available";

  const isInitialLoading = state === "loading" && !metrics;
  const isRefreshing = state === "refreshing";

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard Metrics</h1>
          <p className="mt-1 text-sm text-muted">
            Auto-refreshes every 30 seconds. Next refresh in{" "}
            <span className="font-semibold text-slate-700">{secondsUntilRefresh}s</span>.
          </p>
          <p className="mt-1 text-xs text-muted">Last updated: {lastUpdatedDisplay}</p>
        </div>

        <button
          type="button"
          onClick={() => void fetchMetrics("manual")}
          disabled={isRefreshing}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefreshing ? "Refreshing..." : "Refresh now"}
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            className="mt-2 rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
            onClick={() => void fetchMetrics("manual")}
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricsCard
          label="Total Workflows"
          value={isInitialLoading ? "Loading..." : (metrics?.totalWorkflows ?? 0)}
        />
        <MetricsCard
          label="Active Runs"
          value={isInitialLoading ? "Loading..." : (metrics?.activeRuns ?? 0)}
        />
        <MetricsCard
          label="Pending Tasks"
          value={isInitialLoading ? "Loading..." : (metrics?.pendingTasks ?? 0)}
        />
        <MetricsCard
          label="Total Leads"
          value={isInitialLoading ? "Loading..." : (metrics?.totalLeads ?? 0)}
        />
      </div>
    </section>
  );
}
