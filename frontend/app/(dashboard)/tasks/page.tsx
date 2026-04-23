"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { getCurrentUser, getStoredToken, logout } from "@/lib/auth";
import type { CurrentUser, Task, TaskListResponse } from "@/types/api";

type TaskStatusUi = "all" | "pending" | "in_progress" | "completed" | "cancelled";
type TaskPriorityUi = "all" | "low" | "medium" | "high";

interface TaskEditorState {
  title: string;
  description: string;
  status: Exclude<TaskStatusUi, "all">;
  priority: Exclude<TaskPriorityUi, "all">;
  assignedToId: string;
  dueDate: string;
}

const PAGE_SIZE = 20;

function toUiStatus(status: Task["status"]): Exclude<TaskStatusUi, "all"> {
  if (status === "overdue") {
    return "cancelled";
  }
  return status;
}

function toBackendStatus(status: Exclude<TaskStatusUi, "all">): Task["status"] {
  if (status === "cancelled") {
    return "overdue";
  }
  return status;
}

function toUiPriority(priority: Task["priority"]): Exclude<TaskPriorityUi, "all"> {
  if (priority === "urgent") {
    return "high";
  }
  return priority;
}

function toBackendPriority(priority: Exclude<TaskPriorityUi, "all">): Task["priority"] {
  return priority;
}

function statusBadgeClass(status: Exclude<TaskStatusUi, "all">): string {
  if (status === "pending") return "bg-slate-200 text-slate-800";
  if (status === "in_progress") return "bg-blue-100 text-blue-800";
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  return "bg-rose-100 text-rose-800";
}

function priorityBadgeClass(priority: Exclude<TaskPriorityUi, "all">): string {
  if (priority === "low") return "bg-slate-200 text-slate-800";
  if (priority === "medium") return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function toInputDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function truncate(text: string | null | undefined, max = 80): string {
  const value = (text ?? "").trim();
  if (!value) return "-";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function defaultEditor(): TaskEditorState {
  return {
    title: "",
    description: "",
    status: "pending",
    priority: "medium",
    assignedToId: "",
    dueDate: "",
  };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<TaskStatusUi>("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityUi>("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [editor, setEditor] = useState<TaskEditorState>(defaultEditor());

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const titleMatch = task.title.toLowerCase().includes(query);
      const priorityMatch =
        priorityFilter === "all" || toUiPriority(task.priority) === priorityFilter;
      return titleMatch && priorityMatch;
    });
  }, [priorityFilter, search, tasks]);

  const resolveAssignee = useCallback(
    (assignedTo: string | null): string => {
      if (!assignedTo) return "-";
      if (currentUser && currentUser.user_id === assignedTo) return currentUser.email;
      return `${assignedTo.slice(0, 8)}…`;
    },
    [currentUser],
  );

  const hydrateEditorFromTask = useCallback((task: Task) => {
    setEditor({
      title: task.title,
      description: task.description ?? "",
      status: toUiStatus(task.status),
      priority: toUiPriority(task.priority),
      assignedToId: task.assigned_to ?? "",
      dueDate: toInputDateTime(task.due_date),
    });
  }, []);

  const loadTasks = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      logout();
      window.location.replace("/login");
      return;
    }

    setIsLoading(true);
    setError(null);

    const skip = (page - 1) * PAGE_SIZE;
    const statusQuery =
      statusFilter === "all"
        ? ""
        : `&status=${encodeURIComponent(toBackendStatus(statusFilter))}`;

    try {
      const [taskResponse, userResponse] = await Promise.all([
        apiRequest<TaskListResponse>(
          `/api/v1/tasks?skip=${skip}&limit=${PAGE_SIZE}${statusQuery}`,
          {
            method: "GET",
            authToken: token,
          },
        ),
        getCurrentUser(token),
      ]);

      setTasks(taskResponse.items);
      setTotal(taskResponse.total);
      setCurrentUser(userResponse);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
        window.location.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error ? requestError.message : "Unable to load tasks.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTasks();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTasks]);

  async function openTaskDetails(task: Task) {
    const token = getStoredToken();
    if (!token) {
      logout();
      window.location.replace("/login");
      return;
    }

    setSelectedTask(task);
    setIsDetailsLoading(true);
    setIsEditing(false);
    setError(null);
    try {
      const fullTask = await apiRequest<Task>(`/api/v1/tasks/${task.id}`, {
        method: "GET",
        authToken: token,
      });
      setSelectedTask(fullTask);
      hydrateEditorFromTask(fullTask);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
        window.location.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load task details.",
      );
    } finally {
      setIsDetailsLoading(false);
    }
  }

  async function handleCreateTask() {
    const token = getStoredToken();
    if (!token) {
      logout();
      window.location.replace("/login");
      return;
    }
    if (!editor.title.trim()) {
      setError("Title is required.");
      return;
    }

    setIsSavingCreate(true);
    setError(null);
    try {
      await apiRequest<Task>("/api/v1/tasks", {
        method: "POST",
        authToken: token,
        body: {
          title: editor.title.trim(),
          description: editor.description.trim() || null,
          status: toBackendStatus(editor.status),
          priority: toBackendPriority(editor.priority),
          assigned_to: editor.assignedToId.trim() || null,
          due_date: editor.dueDate ? new Date(editor.dueDate).toISOString() : null,
        },
      });
      setIsCreateOpen(false);
      setEditor(defaultEditor());
      await loadTasks();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
        window.location.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error ? requestError.message : "Unable to create task.",
      );
    } finally {
      setIsSavingCreate(false);
    }
  }

  async function handleSaveTaskEdits() {
    if (!selectedTask) return;
    const token = getStoredToken();
    if (!token) {
      logout();
      window.location.replace("/login");
      return;
    }
    if (!editor.title.trim()) {
      setError("Title is required.");
      return;
    }

    setIsSavingEdit(true);
    setError(null);
    try {
      const updated = await apiRequest<Task>(`/api/v1/tasks/${selectedTask.id}`, {
        method: "PATCH",
        authToken: token,
        body: {
          title: editor.title.trim(),
          description: editor.description.trim() || null,
          status: toBackendStatus(editor.status),
          priority: toBackendPriority(editor.priority),
          assigned_to: editor.assignedToId.trim() || null,
          due_date: editor.dueDate ? new Date(editor.dueDate).toISOString() : null,
        },
      });
      setSelectedTask(updated);
      setIsEditing(false);
      await loadTasks();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
        window.location.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error ? requestError.message : "Unable to update task.",
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteTask() {
    if (!selectedTask) return;
    const token = getStoredToken();
    if (!token) {
      logout();
      window.location.replace("/login");
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      await apiRequest<{ message: string }>(`/api/v1/tasks/${selectedTask.id}`, {
        method: "DELETE",
        authToken: token,
      });
      setSelectedTask(null);
      setIsEditing(false);
      await loadTasks();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
        window.location.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error ? requestError.message : "Unable to delete task.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleMarkComplete() {
    if (!selectedTask) return;
    const token = getStoredToken();
    if (!token) {
      logout();
      window.location.replace("/login");
      return;
    }
    setIsCompleting(true);
    setError(null);
    try {
      const updated = await apiRequest<Task>(`/api/v1/tasks/${selectedTask.id}`, {
        method: "PATCH",
        authToken: token,
        body: { status: "completed" },
      });
      setSelectedTask(updated);
      hydrateEditorFromTask(updated);
      await loadTasks();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
        window.location.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to mark task complete.",
      );
    } finally {
      setIsCompleting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tasks</h1>
          <p className="mt-1 text-sm text-muted">
            Manage task lifecycle, assignments, and due dates.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
          onClick={() => {
            setEditor(defaultEditor());
            setIsCreateOpen(true);
            setError(null);
          }}
        >
          Create Task
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title"
          className="min-w-[250px] rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as TaskStatusUi);
            setPage(1);
          }}
          className="rounded-md border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value as TaskPriorityUi)}
          className="rounded-md border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          onClick={() => void loadTasks()}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            className="mt-2 rounded-md border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
            onClick={() => void loadTasks()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">
          Loading tasks...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">
          No tasks found for the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-700">Title</th>
                <th className="px-4 py-3 font-medium text-slate-700">Description</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
                <th className="px-4 py-3 font-medium text-slate-700">Priority</th>
                <th className="px-4 py-3 font-medium text-slate-700">Assigned To</th>
                <th className="px-4 py-3 font-medium text-slate-700">Due Date</th>
                <th className="px-4 py-3 font-medium text-slate-700">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const status = toUiStatus(task.status);
                const priority = toUiPriority(task.priority);
                return (
                  <tr
                    key={task.id}
                    className="cursor-pointer border-t border-border hover:bg-slate-50"
                    onClick={() => void openTaskDetails(task)}
                  >
                    <td className="px-4 py-3 text-slate-900">{task.title}</td>
                    <td className="px-4 py-3 text-slate-700">{truncate(task.description)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize",
                          statusBadgeClass(status),
                        ].join(" ")}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize",
                          priorityBadgeClass(priority),
                        ].join(" ")}
                      >
                        {priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{resolveAssignee(task.assigned_to)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(task.due_date)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(task.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-slate-700">
        <p>
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            className="h-full flex-1 bg-slate-900/30"
            onClick={() => setIsCreateOpen(false)}
            aria-label="Close create task panel"
          />
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Create Task</h2>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
                onClick={() => setIsCreateOpen(false)}
              >
                Close
              </button>
            </div>
            <TaskForm
              editor={editor}
              onChange={setEditor}
              onSubmit={() => void handleCreateTask()}
              submitLabel={isSavingCreate ? "Creating..." : "Create Task"}
              disabled={isSavingCreate}
            />
          </aside>
        </div>
      ) : null}

      {selectedTask ? (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            className="h-full flex-1 bg-slate-900/30"
            onClick={() => {
              setSelectedTask(null);
              setIsEditing(false);
            }}
            aria-label="Close task details panel"
          />
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Task Details</h2>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
                onClick={() => {
                  setSelectedTask(null);
                  setIsEditing(false);
                }}
              >
                Close
              </button>
            </div>

            {isDetailsLoading ? (
              <p className="text-sm text-muted">Loading task details...</p>
            ) : (
              <div className="space-y-4">
                {!isEditing ? (
                  <>
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <DetailItem label="Title" value={selectedTask.title} />
                      <DetailItem
                        label="Status"
                        value={toUiStatus(selectedTask.status)}
                        capitalize
                      />
                      <DetailItem
                        label="Priority"
                        value={toUiPriority(selectedTask.priority)}
                        capitalize
                      />
                      <DetailItem
                        label="Assigned To"
                        value={resolveAssignee(selectedTask.assigned_to)}
                      />
                      <DetailItem label="Due Date" value={formatDate(selectedTask.due_date)} />
                      <DetailItem label="Created" value={formatDate(selectedTask.created_at)} />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Description</p>
                      <p className="mt-1 rounded-md border border-border bg-slate-50 p-3 text-sm text-slate-800 whitespace-pre-wrap">
                        {selectedTask.description?.trim() || "No description"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(selectedTask.status === "pending" ||
                        selectedTask.status === "in_progress") && (
                        <button
                          type="button"
                          className="rounded-md border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          disabled={isCompleting}
                          onClick={() => void handleMarkComplete()}
                        >
                          {isCompleting ? "Completing..." : "Mark Complete"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
                        onClick={() => {
                          hydrateEditorFromTask(selectedTask);
                          setIsEditing(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        disabled={isDeleting}
                        onClick={() => void handleDeleteTask()}
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <TaskForm
                      editor={editor}
                      onChange={setEditor}
                      onSubmit={() => void handleSaveTaskEdits()}
                      submitLabel={isSavingEdit ? "Saving..." : "Save"}
                      disabled={isSavingEdit}
                    />
                    <button
                      type="button"
                      className="rounded-md border border-border px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => {
                        if (selectedTask) hydrateEditorFromTask(selectedTask);
                        setIsEditing(false);
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function DetailItem({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-sm text-slate-800 ${capitalize ? "capitalize" : ""}`}>{value}</p>
    </div>
  );
}

function TaskForm({
  editor,
  onChange,
  onSubmit,
  submitLabel,
  disabled,
}: {
  editor: TaskEditorState;
  onChange: (next: TaskEditorState) => void;
  onSubmit: () => void;
  submitLabel: string;
  disabled: boolean;
}) {
  function update<K extends keyof TaskEditorState>(key: K, value: TaskEditorState[K]) {
    onChange({ ...editor, [key]: value });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="task-title">
          Title
        </label>
        <input
          id="task-title"
          value={editor.title}
          onChange={(event) => update("title", event.target.value)}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label
          className="mb-1 block text-sm font-medium text-slate-700"
          htmlFor="task-description"
        >
          Description
        </label>
        <textarea
          id="task-description"
          rows={4}
          value={editor.description}
          onChange={(event) => update("description", event.target.value)}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="task-status">
            Status
          </label>
          <select
            id="task-status"
            value={editor.status}
            onChange={(event) =>
              update("status", event.target.value as Exclude<TaskStatusUi, "all">)
            }
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-slate-700"
            htmlFor="task-priority"
          >
            Priority
          </label>
          <select
            id="task-priority"
            value={editor.priority}
            onChange={(event) =>
              update("priority", event.target.value as Exclude<TaskPriorityUi, "all">)
            }
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            className="mb-1 block text-sm font-medium text-slate-700"
            htmlFor="task-assigned"
          >
            Assigned To ID (optional)
          </label>
          <input
            id="task-assigned"
            value={editor.assignedToId}
            onChange={(event) => update("assignedToId", event.target.value)}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            placeholder="User UUID"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="task-due">
            Due Date (optional)
          </label>
          <input
            id="task-due"
            type="datetime-local"
            value={editor.dueDate}
            onChange={(event) => update("dueDate", event.target.value)}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        type="button"
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        onClick={onSubmit}
        disabled={disabled}
      >
        {submitLabel}
      </button>
    </div>
  );
}
