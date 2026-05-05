"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";

interface Department { id: string; name: string }
interface Employee {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  employment_type: string;
  salary_type: string;
  gross_salary: number;
  department_id: string | null;
  department_name: string | null;
  is_active: boolean;
  start_date: string | null;
}
interface EmployeeListResponse { items: Employee[]; total: number }

const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "intern"];
const SALARY_TYPES = ["monthly", "annual", "hourly"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency", currency: "ZAR", maximumFractionDigits: 0,
  }).format(n);
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function badge(type: string) {
  const m: Record<string, string> = {
    full_time: "bg-emerald-500/20 text-emerald-300",
    part_time:  "bg-blue-500/20 text-blue-300",
    contract:   "bg-orange-500/20 text-orange-300",
    intern:     "bg-violet-500/20 text-violet-300",
  };
  return m[type] ?? "bg-white/10 text-slate-300";
}

interface EmployeeForm {
  first_name: string; last_name: string; email: string; phone: string;
  position: string; department_id: string; employment_type: string;
  salary_type: string; gross_salary: string; start_date: string; notes: string;
}

const EMPTY_FORM: EmployeeForm = {
  first_name: "", last_name: "", email: "", phone: "",
  position: "", department_id: "", employment_type: "full_time",
  salary_type: "monthly", gross_salary: "", start_date: "", notes: "",
};

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      {children}
      {error && <p className="mt-1 text-[11px] text-rose-400">{error}</p>}
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none";
const SELECT = `${INPUT} appearance-none`;

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<EmployeeForm>>({});
  const [serverError, setServerError] = useState("");

  const token = getStoredToken();

  const loadEmployees = useCallback(() => {
    setLoading(true);
    apiRequest<EmployeeListResponse>("/api/v1/hr/employees?limit=50", { authToken: token })
      .then((d) => { setEmployees(d.items ?? []); setTotal(d.total ?? 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    loadEmployees();
    apiRequest<Department[]>("/api/v1/hr/departments", { authToken: token })
      .then(setDepartments)
      .catch(() => null);
  }, [loadEmployees, token]);

  function set(field: keyof EmployeeForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<EmployeeForm> = {};
    if (!form.first_name.trim()) e.first_name = "Required";
    if (!form.last_name.trim())  e.last_name  = "Required";
    if (!form.gross_salary || isNaN(Number(form.gross_salary))) e.gross_salary = "Must be a number";
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
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        employment_type: form.employment_type,
        salary_type: form.salary_type,
        gross_salary: Number(form.gross_salary),
      };
      if (form.email)         body.email         = form.email.trim();
      if (form.phone)         body.phone         = form.phone.trim();
      if (form.position)      body.position      = form.position.trim();
      if (form.department_id) body.department_id = form.department_id;
      if (form.start_date)    body.start_date    = form.start_date;
      if (form.notes)         body.notes         = form.notes.trim();

      await apiRequest("/api/v1/hr/employees", { method: "POST", body, authToken: token });
      setShowModal(false);
      setForm(EMPTY_FORM);
      loadEmployees();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Failed to create employee.");
    } finally {
      setSaving(false);
    }
  }

  const active      = employees.filter((e) => e.is_active).length;
  const totalPayroll = employees.filter((e) => e.is_active)
    .reduce((s, e) => s + Number(e.gross_salary), 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Employees" subtitle={`${total} total · ${active} active`} />
        <button
          type="button"
          onClick={() => { setShowModal(true); setForm(EMPTY_FORM); setErrors({}); setServerError(""); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          + Add Employee
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Employees", value: String(total),     color: "bg-blue-500" },
          { label: "Active",          value: String(active),    color: "bg-emerald-500" },
          { label: "Monthly Payroll", value: fmt(totalPayroll), color: "bg-violet-500" },
        ].map((c) => (
          <div key={c.label} className="relative overflow-hidden rounded-xl border border-white/6 bg-[#1e293b] p-5">
            <div className={`absolute left-0 top-0 h-full w-1 ${c.color}`} />
            <p className="text-xs font-medium text-slate-400">{c.label}</p>
            <p className="mt-1.5 text-2xl font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/6 bg-[#1e293b]">
        <div className="border-b border-white/6 px-5 py-3">
          <p className="text-sm font-semibold text-slate-300">All Employees</p>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-400">Loading…</div>
        ) : employees.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No employees yet. Click <strong className="text-white">+ Add Employee</strong> to get started.
          </div>
        ) : (
          <div className="divide-y divide-white/4">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                  {initials(emp.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{emp.full_name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {emp.position ?? "—"} · {emp.department_name ?? "No department"}
                    {emp.email ? ` · ${emp.email}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge(emp.employment_type)}`}>
                  {emp.employment_type.replace("_", " ")}
                </span>
                <p className="shrink-0 text-sm text-slate-400">{fmt(Number(emp.gross_salary))}</p>
                <span className={`h-2 w-2 shrink-0 rounded-full ${emp.is_active ? "bg-emerald-400" : "bg-slate-600"}`} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create Employee Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
              <h2 className="text-base font-semibold text-white">Add Employee</h2>
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
              <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name *" error={errors.first_name}>
                    <input className={INPUT} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} placeholder="e.g. Thabo" />
                  </Field>
                  <Field label="Last Name *" error={errors.last_name}>
                    <input className={INPUT} value={form.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="e.g. Mokoena" />
                  </Field>
                  <Field label="Email">
                    <input type="email" className={INPUT} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="thabo@company.com" />
                  </Field>
                  <Field label="Phone">
                    <input className={INPUT} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+27 71 234 5678" />
                  </Field>
                  <Field label="Position / Job Title">
                    <input className={INPUT} value={form.position} onChange={(e) => set("position", e.target.value)} placeholder="e.g. Sales Manager" />
                  </Field>
                  <Field label="Department">
                    <select aria-label="Department" className={SELECT} value={form.department_id} onChange={(e) => set("department_id", e.target.value)}>
                      <option value="">No department</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Employment Type">
                    <select aria-label="Employment Type" className={SELECT} value={form.employment_type} onChange={(e) => set("employment_type", e.target.value)}>
                      {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                    </select>
                  </Field>
                  <Field label="Salary Type">
                    <select aria-label="Salary Type" className={SELECT} value={form.salary_type} onChange={(e) => set("salary_type", e.target.value)}>
                      {SALARY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Gross Salary (R) *" error={errors.gross_salary}>
                    <input type="number" min="0" step="100" className={INPUT} value={form.gross_salary} onChange={(e) => set("gross_salary", e.target.value)} placeholder="25000" />
                  </Field>
                  <Field label="Start Date">
                    <input type="date" className={INPUT} value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="Notes">
                    <textarea aria-label="Notes" rows={2} className={`${INPUT} resize-none`} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes…" />
                  </Field>
                </div>
                {serverError && (
                  <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{serverError}</p>
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
                  {saving ? "Saving…" : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
