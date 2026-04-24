"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { getStoredToken, logout } from "@/lib/auth";
import type { Workflow, WorkflowListResponse } from "@/types/api";

type WorkflowStatusFilter = "all" | "active" | "inactive";
type WorkflowSortField = "name" | "trigger" | "created" | "status";
type SortDirection = "asc" | "desc";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkflowStatusFilter>("all");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [sortField, setSortField] = useState<WorkflowSortField>("created");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

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
      setError(toErrorMessage(requestError, "Unable to load workflows"));
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

  const triggerOptions = useMemo(() => {
    return Array.from(new Set(workflows.map((workflow) => workflow.trigger_event_type))).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [workflows]);

  const filteredWorkflows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return workflows.filter((workflow) => {
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "active" ? workflow.enabled : !workflow.enabled);
      const triggerMatch =
        triggerFilter === "all" || workflow.trigger_event_type === triggerFilter;
      const searchMatch =
        !query ||
        workflow.name.toLowerCase().includes(query) ||
        (workflow.description ?? "").toLowerCase().includes(query);

      return statusMatch && triggerMatch && searchMatch;
    });
  }, [searchQuery, statusFilter, triggerFilter, workflows]);

  const sortedWorkflows = useMemo(() => {
    const sorted = [...filteredWorkflows];
    sorted.sort((left, right) => {
      if (sortField === "name") {
        return left.name.localeCompare(right.name);
      }
      if (sortField === "trigger") {
        return left.trigger_event_type.localeCompare(right.trigger_event_type);
      }
      if (sortField === "status") {
        if (left.enabled === right.enabled) {
          return left.name.localeCompare(right.name);
        }
        return left.enabled ? -1 : 1;
      }
      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    });

    if (sortDirection === "desc") {
      sorted.reverse();
    }
    return sorted;
  }, [filteredWorkflows, sortDirection, sortField]);

  const visibleWorkflowIdSet = useMemo(
    () => new Set(sortedWorkflows.map((workflow) => workflow.id)),
    [sortedWorkflows],
  );

  const selectedVisibleWorkflowIds = useMemo(
    () => selectedWorkflowIds.filter((workflowId) => visibleWorkflowIdSet.has(workflowId)),
    [selectedWorkflowIds, visibleWorkflowIdSet],
  );

  const allVisibleSelected =
    sortedWorkflows.length > 0 &&
    selectedVisibleWorkflowIds.length === sortedWorkflows.length;

  const handleSortChange = useCallback((field: WorkflowSortField) => {
    setSortField((previousField) => {
      if (previousField === field) {
        setSortDirection((previousDirection) =>
          previousDirection === "asc" ? "desc" : "asc",
        );
        return previousField;
      }
      setSortDirection(field === "created" ? "desc" : "asc");
      return field;
    });
  }, []);

  const handleToggleAllVisible = useCallback(() => {
    if (sortedWorkflows.length === 0) {
      return;
    }

    setSelectedWorkflowIds((previous) => {
      if (allVisibleSelected) {
        const visible = new Set(sortedWorkflows.map((workflow) => workflow.id));
        return previous.filter((workflowId) => !visible.has(workflowId));
      }

      const merged = new Set(previous);
      for (const workflow of sortedWorkflows) {
        merged.add(workflow.id);
      }
      return Array.from(merged);
    });
  }, [allVisibleSelected, sortedWorkflows]);

  const handleToggleOne = useCallback((workflowId: string) => {
    setSelectedWorkflowIds((previous) => {
      if (previous.includes(workflowId)) {
        return previous.filter((id) => id !== workflowId);
      }
      return [...previous, workflowId];
    });
  }, []);

  const handleBulkToggle = useCallback(
    async (enabled: boolean) => {
      if (selectedVisibleWorkflowIds.length === 0) {
        return;
      }

      const token = getStoredToken();
      if (!token) {
        logout();
        window.location.replace("/login");
        return;
      }

      setIsBulkUpdating(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const outcomes = await Promise.allSettled(
          selectedVisibleWorkflowIds.map((workflowId) =>
            apiRequest<Workflow>(
              `/api/v1/workflows/${workflowId}/toggle?enabled=${enabled}`,
              {
                method: "PATCH",
                authToken: token,
              },
            ),
          ),
        );

        const successCount = outcomes.filter(
          (outcome) => outcome.status === "fulfilled",
        ).length;
        const failureCount = outcomes.length - successCount;

        if (successCount > 0) {
          await loadWorkflows();
          setSelectedWorkflowIds((previous) =>
            previous.filter(
              (workflowId) => !selectedVisibleWorkflowIds.includes(workflowId),
            ),
          );
          setSuccessMessage(
            `${enabled ? "Enabled" : "Disabled"} ${successCount} workflow${successCount === 1 ? "" : "s"}.`,
          );
        }

        if (failureCount > 0) {
          const firstFailure = outcomes.find(
            (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected",
          );
          const reason = firstFailure
            ? toErrorMessage(firstFailure.reason, "Unable to update selected workflows.")
            : "Unable to update selected workflows.";
          setError(
            `${reason} (${failureCount} failed${successCount > 0 ? `, ${successCount} succeeded` : ""})`,
          );
        }
      } finally {
        setIsBulkUpdating(false);
      }
    },
    [loadWorkflows, selectedVisibleWorkflowIds],
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

      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search name or description"
          className="rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as WorkflowStatusFilter)}
          className="rounded-md border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={triggerFilter}
          onChange={(event) => setTriggerFilter(event.target.value)}
          className="rounded-md border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="all">All trigger types</option>
          {triggerOptions.map((triggerType) => (
            <option key={triggerType} value={triggerType}>
              {triggerType}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          onClick={() => {
            setSearchQuery("");
            setStatusFilter("all");
            setTriggerFilter("all");
          }}
        >
          Clear Filters
        </button>
      </div>

      {selectedVisibleWorkflowIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-slate-50 px-4 py-3 text-sm">
          <p className="text-slate-700">
            Selected {selectedVisibleWorkflowIds.length} workflow
            {selectedVisibleWorkflowIds.length === 1 ? "" : "s"}.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
              disabled={isBulkUpdating}
              onClick={() => void handleBulkToggle(true)}
            >
              {isBulkUpdating ? "Updating..." : "Enable Selected"}
            </button>
            <button
              type="button"
              className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
              disabled={isBulkUpdating}
              onClick={() => void handleBulkToggle(false)}
            >
              {isBulkUpdating ? "Updating..." : "Disable Selected"}
            </button>
          </div>
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

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
          No workflows found for the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleAllVisible}
                    aria-label="Select all visible workflows"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                    onClick={() => handleSortChange("name")}
                  >
                    Name
                    <SortIndicator
                      active={sortField === "name"}
                      direction={sortDirection}
                    />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                    onClick={() => handleSortChange("trigger")}
                  >
                    Trigger
                    <SortIndicator
                      active={sortField === "trigger"}
                      direction={sortDirection}
                    />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">Description</th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                    onClick={() => handleSortChange("created")}
                  >
                    Created
                    <SortIndicator
                      active={sortField === "created"}
                      direction={sortDirection}
                    />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                    onClick={() => handleSortChange("status")}
                  >
                    Status
                    <SortIndicator
                      active={sortField === "status"}
                      direction={sortDirection}
                    />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedWorkflows.map((workflow) => (
                <tr
                  key={workflow.id}
                  className="cursor-pointer border-t border-border hover:bg-slate-50"
                  onClick={() => router.push(`/workflows/${workflow.id}`)}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedWorkflowIds.includes(workflow.id)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => handleToggleOne(workflow.id)}
                      aria-label={`Select ${workflow.name}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{workflow.name}</td>
                  <td className="px-4 py-3 text-slate-700">{workflow.trigger_event_type}</td>
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

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) {
    return <span className="text-slate-300">↕</span>;
  }
  return <span>{direction === "asc" ? "↑" : "↓"}</span>;
}
