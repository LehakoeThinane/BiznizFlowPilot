"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { getStoredToken, logout } from "@/lib/auth";
import type { Customer, CustomerListResponse, Lead, LeadListResponse } from "@/types/api";

type LeadStatusUi = "all" | "new" | "contacted" | "qualified" | "converted" | "lost";

interface LeadEditorState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  status: Exclude<LeadStatusUi, "all">;
  source: string;
  notes: string;
}

const PAGE_SIZE = 20;

function toUiStatus(status: Lead["status"]): Exclude<LeadStatusUi, "all"> {
  if (status === "won") {
    return "converted";
  }
  return status;
}

function toBackendStatus(status: Exclude<LeadStatusUi, "all">): Lead["status"] {
  if (status === "converted") {
    return "won";
  }
  return status;
}

function statusBadgeClass(status: Exclude<LeadStatusUi, "all">): string {
  if (status === "new") return "bg-slate-200 text-slate-800";
  if (status === "contacted") return "bg-blue-100 text-blue-800";
  if (status === "qualified") return "bg-amber-100 text-amber-800";
  if (status === "converted") return "bg-emerald-100 text-emerald-800";
  return "bg-rose-100 text-rose-800";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function splitName(name: string | null | undefined): { firstName: string; lastName: string } {
  const safe = (name ?? "").trim();
  if (!safe) {
    return { firstName: "", lastName: "" };
  }
  const [firstName, ...rest] = safe.split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}

function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, Customer>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<LeadStatusUi>("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editor, setEditor] = useState<LeadEditorState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    status: "new",
    source: "",
    notes: "",
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return leads;

    return leads.filter((lead) => {
      const customer = lead.customer_id ? customersById[lead.customer_id] : undefined;
      const name = customer?.name?.toLowerCase() ?? "";
      const email = customer?.email?.toLowerCase() ?? "";
      return name.includes(query) || email.includes(query);
    });
  }, [customersById, leads, search]);

  const hydrateEditorFromLead = useCallback(
    (lead: Lead) => {
      const customer = lead.customer_id ? customersById[lead.customer_id] : undefined;
      const nameParts = splitName(customer?.name);
      setEditor({
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        email: customer?.email ?? "",
        phone: customer?.phone ?? "",
        company: customer?.company ?? "",
        status: toUiStatus(lead.status),
        source: lead.source ?? "",
        notes: lead.notes ?? "",
      });
    },
    [customersById],
  );

  const loadLeads = useCallback(async () => {
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
      const [leadResponse, customerResponse] = await Promise.all([
        apiRequest<LeadListResponse>(
          `/api/v1/leads?skip=${skip}&limit=${PAGE_SIZE}${statusQuery}`,
          {
            method: "GET",
            authToken: token,
          },
        ),
        apiRequest<CustomerListResponse>("/api/v1/customers?skip=0&limit=1000", {
          method: "GET",
          authToken: token,
        }),
      ]);

      const customerMap: Record<string, Customer> = {};
      for (const customer of customerResponse.items) {
        customerMap[customer.id] = customer;
      }

      setLeads(leadResponse.items);
      setTotal(leadResponse.total);
      setCustomersById(customerMap);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
        window.location.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error ? requestError.message : "Unable to load leads.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLeads();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLeads]);

  async function openLeadDetails(lead: Lead) {
    const token = getStoredToken();
    if (!token) {
      logout();
      window.location.replace("/login");
      return;
    }

    setSelectedLead(lead);
    setIsDetailsLoading(true);
    setIsEditing(false);
    setError(null);

    try {
      const fullLead = await apiRequest<Lead>(`/api/v1/leads/${lead.id}`, {
        method: "GET",
        authToken: token,
      });
      setSelectedLead(fullLead);
      hydrateEditorFromLead(fullLead);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
        window.location.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load lead details.",
      );
    } finally {
      setIsDetailsLoading(false);
    }
  }

  function resetCreateForm() {
    setEditor({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      status: "new",
      source: "",
      notes: "",
    });
  }

  async function handleCreateLead() {
    const token = getStoredToken();
    if (!token) {
      logout();
      window.location.replace("/login");
      return;
    }

    const name = fullName(editor.firstName, editor.lastName);
    if (!name) {
      setError("First and/or last name is required.");
      return;
    }

    setIsSavingCreate(true);
    setError(null);

    try {
      const customer = await apiRequest<Customer>("/api/v1/customers", {
        method: "POST",
        authToken: token,
        body: {
          name,
          email: editor.email.trim() || null,
          phone: editor.phone.trim() || null,
          company: editor.company.trim() || null,
          notes: editor.notes.trim() || null,
        },
      });

      await apiRequest<Lead>("/api/v1/leads", {
        method: "POST",
        authToken: token,
        body: {
          customer_id: customer.id,
          status: toBackendStatus(editor.status),
          source: editor.source.trim() || null,
          notes: editor.notes.trim() || null,
        },
      });

      setIsCreateOpen(false);
      resetCreateForm();
      await loadLeads();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
        window.location.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error ? requestError.message : "Unable to create lead.",
      );
    } finally {
      setIsSavingCreate(false);
    }
  }

  async function handleSaveLeadEdits() {
    if (!selectedLead) return;
    const token = getStoredToken();
    if (!token) {
      logout();
      window.location.replace("/login");
      return;
    }

    const name = fullName(editor.firstName, editor.lastName);
    if (!name) {
      setError("First and/or last name is required.");
      return;
    }

    setIsSavingEdit(true);
    setError(null);

    try {
      let customerId = selectedLead.customer_id;
      if (customerId) {
        await apiRequest<Customer>(`/api/v1/customers/${customerId}`, {
          method: "PATCH",
          authToken: token,
          body: {
            name,
            email: editor.email.trim() || null,
            phone: editor.phone.trim() || null,
            company: editor.company.trim() || null,
            notes: editor.notes.trim() || null,
          },
        });
      } else {
        const createdCustomer = await apiRequest<Customer>("/api/v1/customers", {
          method: "POST",
          authToken: token,
          body: {
            name,
            email: editor.email.trim() || null,
            phone: editor.phone.trim() || null,
            company: editor.company.trim() || null,
            notes: editor.notes.trim() || null,
          },
        });
        customerId = createdCustomer.id;
      }

      const updatedLead = await apiRequest<Lead>(`/api/v1/leads/${selectedLead.id}`, {
        method: "PATCH",
        authToken: token,
        body: {
          customer_id: customerId,
          status: toBackendStatus(editor.status),
          source: editor.source.trim() || null,
          notes: editor.notes.trim() || null,
        },
      });

      setSelectedLead(updatedLead);
      setIsEditing(false);
      await loadLeads();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
        window.location.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error ? requestError.message : "Unable to update lead.",
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteLead() {
    if (!selectedLead) return;
    const token = getStoredToken();
    if (!token) {
      logout();
      window.location.replace("/login");
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      await apiRequest<{ message: string }>(`/api/v1/leads/${selectedLead.id}`, {
        method: "DELETE",
        authToken: token,
      });
      setSelectedLead(null);
      setIsEditing(false);
      await loadLeads();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
        window.location.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error ? requestError.message : "Unable to delete lead.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const selectedCustomer =
    selectedLead?.customer_id ? customersById[selectedLead.customer_id] : undefined;
  const selectedNameParts = splitName(selectedCustomer?.name);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
          <p className="mt-1 text-sm text-muted">
            Manage lead pipeline, customer identity, and conversion status.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
          onClick={() => {
            resetCreateForm();
            setIsCreateOpen(true);
            setError(null);
          }}
        >
          Add Lead
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or email"
          className="min-w-[250px] rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as LeadStatusUi);
            setPage(1);
          }}
          className="rounded-md border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          onClick={() => void loadLeads()}
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
            onClick={() => void loadLeads()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">
          Loading leads...
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">
          No leads found for the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-700">Name</th>
                <th className="px-4 py-3 font-medium text-slate-700">Email</th>
                <th className="px-4 py-3 font-medium text-slate-700">Phone</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
                <th className="px-4 py-3 font-medium text-slate-700">Source</th>
                <th className="px-4 py-3 font-medium text-slate-700">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => {
                const customer = lead.customer_id ? customersById[lead.customer_id] : undefined;
                const nameParts = splitName(customer?.name);
                const displayStatus = toUiStatus(lead.status);
                return (
                  <tr
                    key={lead.id}
                    className="cursor-pointer border-t border-border hover:bg-slate-50"
                    onClick={() => void openLeadDetails(lead)}
                  >
                    <td className="px-4 py-3 text-slate-900">
                      {fullName(nameParts.firstName, nameParts.lastName) || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{customer?.email ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{customer?.phone ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize",
                          statusBadgeClass(displayStatus),
                        ].join(" ")}
                      >
                        {displayStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{lead.source ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(lead.created_at)}</td>
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
            aria-label="Close create lead panel"
          />
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Add Lead</h2>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
                onClick={() => setIsCreateOpen(false)}
              >
                Close
              </button>
            </div>
            <LeadForm
              editor={editor}
              onChange={setEditor}
              onSubmit={() => void handleCreateLead()}
              submitLabel={isSavingCreate ? "Creating..." : "Create Lead"}
              disabled={isSavingCreate}
            />
          </aside>
        </div>
      ) : null}

      {selectedLead ? (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            className="h-full flex-1 bg-slate-900/30"
            onClick={() => {
              setSelectedLead(null);
              setIsEditing(false);
            }}
            aria-label="Close lead details panel"
          />
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Lead Details</h2>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
                onClick={() => {
                  setSelectedLead(null);
                  setIsEditing(false);
                }}
              >
                Close
              </button>
            </div>

            {isDetailsLoading ? (
              <p className="text-sm text-muted">Loading lead details...</p>
            ) : (
              <div className="space-y-4">
                {!isEditing ? (
                  <>
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <DetailItem label="First Name" value={selectedNameParts.firstName || "-"} />
                      <DetailItem label="Last Name" value={selectedNameParts.lastName || "-"} />
                      <DetailItem label="Email" value={selectedCustomer?.email ?? "-"} />
                      <DetailItem label="Phone" value={selectedCustomer?.phone ?? "-"} />
                      <DetailItem label="Company" value={selectedCustomer?.company ?? "-"} />
                      <DetailItem
                        label="Status"
                        value={toUiStatus(selectedLead.status)}
                        capitalize
                      />
                      <DetailItem label="Source" value={selectedLead.source ?? "-"} />
                      <DetailItem label="Created" value={formatDate(selectedLead.created_at)} />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Notes</p>
                      <p className="mt-1 rounded-md border border-border bg-slate-50 p-3 text-sm text-slate-800 whitespace-pre-wrap">
                        {selectedLead.notes?.trim() || "No notes"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
                        onClick={() => {
                          if (selectedLead) {
                            hydrateEditorFromLead(selectedLead);
                          }
                          setIsEditing(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        disabled={isDeleting}
                        onClick={() => void handleDeleteLead()}
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <LeadForm
                      editor={editor}
                      onChange={setEditor}
                      onSubmit={() => void handleSaveLeadEdits()}
                      submitLabel={isSavingEdit ? "Saving..." : "Save"}
                      disabled={isSavingEdit}
                    />
                    <button
                      type="button"
                      className="rounded-md border border-border px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => {
                        if (selectedLead) hydrateEditorFromLead(selectedLead);
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

function LeadForm({
  editor,
  onChange,
  onSubmit,
  submitLabel,
  disabled,
}: {
  editor: LeadEditorState;
  onChange: (next: LeadEditorState) => void;
  onSubmit: () => void;
  submitLabel: string;
  disabled: boolean;
}) {
  function update<K extends keyof LeadEditorState>(key: K, value: LeadEditorState[K]) {
    onChange({ ...editor, [key]: value });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="first-name">
            First Name
          </label>
          <input
            id="first-name"
            value={editor.firstName}
            onChange={(event) => update("firstName", event.target.value)}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="last-name">
            Last Name
          </label>
          <input
            id="last-name"
            value={editor.lastName}
            onChange={(event) => update("lastName", event.target.value)}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={editor.email}
            onChange={(event) => update("email", event.target.value)}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            value={editor.phone}
            onChange={(event) => update("phone", event.target.value)}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="company">
          Company
        </label>
        <input
          id="company"
          value={editor.company}
          onChange={(event) => update("company", event.target.value)}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            value={editor.status}
            onChange={(event) =>
              update("status", event.target.value as Exclude<LeadStatusUi, "all">)
            }
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="source">
            Source
          </label>
          <input
            id="source"
            value={editor.source}
            onChange={(event) => update("source", event.target.value)}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          rows={4}
          value={editor.notes}
          onChange={(event) => update("notes", event.target.value)}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
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
