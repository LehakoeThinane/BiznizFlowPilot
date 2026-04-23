"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { getStoredToken, logout } from "@/lib/auth";
import type { Workflow, WorkflowListResponse } from "@/types/api";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkflows = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      logout();
      window.location.replace("/login");
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const response = await apiRequest<WorkflowListResponse>("/api/v1/workflows", {
        method: "GET",
        authToken: token,
      });
      setWorkflows(response.workflows);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
        window.location.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load workflows",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadWorkflows();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [loadWorkflows]);

  const sortedWorkflows = useMemo(
    () =>
      [...workflows].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [workflows],
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Workflows</h1>
          <p className="mt-1 text-sm text-muted">
            View all workflow definitions and inspect their current configuration.
          </p>
        </div>
        <Link
          href="/workflows/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          Create Workflow
        </Link>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadWorkflows()}
            className="mt-2 rounded-md border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">
          Loading workflows...
        </div>
      ) : sortedWorkflows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">
          No workflows found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-700">Name</th>
                <th className="px-4 py-3 font-medium text-slate-700">Description</th>
                <th className="px-4 py-3 font-medium text-slate-700">Created</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedWorkflows.map((workflow) => (
                <tr
                  key={workflow.id}
                  className="cursor-pointer border-t border-border hover:bg-slate-50"
                  onClick={() => router.push(`/workflows/${workflow.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{workflow.name}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {workflow.description?.trim() || "No description"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDate(workflow.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
                        workflow.enabled
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700",
                      ].join(" ")}
                    >
                      {workflow.enabled ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
