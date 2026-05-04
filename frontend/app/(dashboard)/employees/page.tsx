"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";

interface Employee {
  id: string;
  full_name: string;
  position: string | null;
  employment_type: string;
  gross_salary: number;
  department_name: string | null;
  is_active: boolean;
}

interface EmployeeListResponse { items: Employee[]; total: number }

function badge(type: string) {
  const map: Record<string, string> = {
    full_time: "bg-emerald-500/20 text-emerald-300",
    part_time: "bg-blue-500/20 text-blue-300",
    contract:  "bg-orange-500/20 text-orange-300",
    intern:    "bg-violet-500/20 text-violet-300",
  };
  return map[type] ?? "bg-white/10 text-slate-300";
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency", currency: "ZAR", maximumFractionDigits: 0,
  }).format(n);
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    apiRequest<EmployeeListResponse>("/api/v1/hr/employees?limit=50", { authToken: token })
      .then((d) => {
        setEmployees(d.items ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const active = employees.filter((e) => e.is_active).length;
  const totalPayroll = employees
    .filter((e) => e.is_active)
    .reduce((s, e) => s + Number(e.gross_salary), 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Employees" subtitle={`${total} total · ${active} active`} />

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Employees", value: String(total),          color: "bg-blue-500" },
          { label: "Active",          value: String(active),         color: "bg-emerald-500" },
          { label: "Monthly Payroll", value: fmt(totalPayroll),      color: "bg-violet-500" },
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
          <div className="px-5 py-8 text-sm text-slate-400">No employees yet.</div>
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
    </div>
  );
}
