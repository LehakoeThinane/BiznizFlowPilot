"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";

interface Employee { id: string; full_name: string }
interface LeaveType { id: string; name: string; default_days: number; is_paid: boolean }
interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type_id: string | null;
  leave_type_name: string | null;
  start_date: string;
  end_date: string;
  days_requested: number;
  status: string;
  reason: string | null;
  approved_at: string | null;
}
interface LeaveListResponse { items: LeaveRequest[]; total: number }

const STATUS_FILTERS = ["all", "pending", "approved", "rejected", "cancelled"];

function statusColor(s: string) {
  if (s === "approved")  return "bg-emerald-500/20 text-emerald-300";
  if (s === "rejected")  return "bg-rose-500/20 text-rose-300";
  if (s === "pending")   return "bg-orange-500/20 text-orange-300";
  if (s === "cancelled") return "bg-slate-500/30 text-slate-400";
  return "bg-white/10 text-slate-300";
}

const INPUT  = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none";
const SELECT = `${INPUT} appearance-none`;

interface LeaveForm {
  employee_id: string; leave_type_id: string;
  start_date: string; end_date: string;
  days_requested: string; reason: string;
}
const EMPTY: LeaveForm = { employee_id: "", leave_type_id: "", start_date: "", end_date: "", days_requested: "", reason: "" };

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      {children}
      {error && <p className="mt-1 text-[11px] text-rose-400">{error}</p>}
    </div>
  );
}

export default function LeavePage() {
  const [requests, setRequests]   = useState<LeaveRequest[]>([]);
  const [total, setTotal]         = useState(0);
  const [filter, setFilter]       = useState("all");
  const [loading, setLoading]     = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState<LeaveForm>(EMPTY);
  const [errors, setErrors]       = useState<Partial<LeaveForm>>({});
  const [saving, setSaving]       = useState(false);
  const [serverError, setServerError] = useState("");

  const token = getStoredToken();

  const loadRequests = useCallback(() => {
    setLoading(true);
    const qs = filter !== "all" ? `&status=${filter}` : "";
    apiRequest<LeaveListResponse>(`/api/v1/hr/leave-requests?limit=50${qs}`, { authToken: token })
      .then((d) => { setRequests(d.items ?? []); setTotal(d.total ?? 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, filter]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  useEffect(() => {
    apiRequest<{ items: Employee[] }>("/api/v1/hr/employees?limit=100", { authToken: token })
      .then((d) => setEmployees(d.items ?? [])).catch(() => null);
    apiRequest<LeaveType[]>("/api/v1/hr/leave-types", { authToken: token })
      .then(setLeaveTypes).catch(() => null);
  }, [token]);

  function set(field: keyof LeaveForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<LeaveForm> = {};
    if (!form.employee_id)   e.employee_id   = "Required";
    if (!form.start_date)    e.start_date    = "Required";
    if (!form.end_date)      e.end_date      = "Required";
    if (!form.days_requested || isNaN(Number(form.days_requested))) e.days_requested = "Must be a number";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setServerError("");
    try {
      const body: Record<string, unknown> = {
        employee_id:    form.employee_id,
        start_date:     form.start_date,
        end_date:       form.end_date,
        days_requested: Number(form.days_requested),
      };
      if (form.leave_type_id) body.leave_type_id = form.leave_type_id;
      if (form.reason)        body.reason        = form.reason.trim();
      await apiRequest("/api/v1/hr/leave-requests", { method: "POST", body, authToken: token });
      setShowModal(false);
      setForm(EMPTY);
      loadRequests();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Failed to submit leave request.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await apiRequest(`/api/v1/hr/leave-requests/${id}/status`, {
        method: "PATCH", body: { status }, authToken: token,
      });
      loadRequests();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update status.");
    }
  }

  const pending   = requests.filter((r) => r.status === "pending").length;
  const approved  = requests.filter((r) => r.status === "approved").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Leave Requests" subtitle={`${total} total · ${pending} pending`} />
        <button
          type="button"
          onClick={() => { setShowModal(true); setForm(EMPTY); setErrors({}); setServerError(""); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          + New Request
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending",  value: String(pending),  color: "bg-orange-500" },
          { label: "Approved", value: String(approved), color: "bg-emerald-500" },
          { label: "Total",    value: String(total),    color: "bg-blue-500" },
        ].map((c) => (
          <div key={c.label} className="relative overflow-hidden rounded-xl border border-white/6 bg-[#1e293b] p-5">
            <div className={`absolute left-0 top-0 h-full w-1 ${c.color}`} />
            <p className="text-xs font-medium text-slate-400">{c.label}</p>
            <p className="mt-1.5 text-2xl font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              filter === s ? "bg-blue-600 text-white" : "bg-white/4 text-slate-400 hover:bg-white/8"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-white/6 bg-[#1e293b]">
        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-400">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No leave requests found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/6 text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Period</th>
                <th className="px-3 py-3 font-medium">Days</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-white/2">
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">{r.employee_name}</p>
                    {r.reason && <p className="text-xs text-slate-500 truncate max-w-[180px]">{r.reason}</p>}
                  </td>
                  <td className="px-3 py-3 text-slate-400">{r.leave_type_name ?? "—"}</td>
                  <td className="px-3 py-3 text-slate-400 whitespace-nowrap">
                    {r.start_date} → {r.end_date}
                  </td>
                  <td className="px-3 py-3 text-white">{r.days_requested}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {r.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateStatus(r.id, "approved")}
                          className="rounded-md bg-emerald-600/20 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-600/40 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(r.id, "rejected")}
                          className="rounded-md bg-rose-600/20 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-600/40 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── New Leave Request Modal ──────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
              <h2 className="text-base font-semibold text-white">New Leave Request</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-4 px-6 py-5">
                <Field label="Employee *" error={errors.employee_id}>
                  <select aria-label="Employee" className={SELECT} value={form.employee_id} onChange={(e) => set("employee_id", e.target.value)}>
                    <option value="">Select employee…</option>
                    {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                  </select>
                </Field>
                <Field label="Leave Type">
                  <select aria-label="Leave Type" className={SELECT} value={form.leave_type_id} onChange={(e) => set("leave_type_id", e.target.value)}>
                    <option value="">General / Unspecified</option>
                    {leaveTypes.map((lt) => (
                      <option key={lt.id} value={lt.id}>{lt.name} {lt.is_paid ? "(Paid)" : "(Unpaid)"}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Start Date *" error={errors.start_date}>
                    <input type="date" className={INPUT} value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
                  </Field>
                  <Field label="End Date *" error={errors.end_date}>
                    <input type="date" className={INPUT} value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
                  </Field>
                </div>
                <Field label="Days Requested *" error={errors.days_requested}>
                  <input type="number" min="0.5" step="0.5" className={INPUT} value={form.days_requested} onChange={(e) => set("days_requested", e.target.value)} placeholder="e.g. 3" />
                </Field>
                <Field label="Reason">
                  <textarea aria-label="Reason" rows={3} className={`${INPUT} resize-none`} value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Optional reason for leave…" />
                </Field>
                {serverError && (
                  <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{serverError}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-white/8 px-6 py-4">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
