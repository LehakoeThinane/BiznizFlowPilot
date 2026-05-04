"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";

interface CategoryTotal { name: string; amount: number }
interface FinanceSummary {
  period_label: string;
  revenue: number;
  expenses: number;
  net_profit: number;
  expense_by_category: CategoryTotal[];
}

const PERIODS = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "ytd",        label: "Year to Date" },
  { value: "this_year",  label: "Full Year" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency", currency: "ZAR", maximumFractionDigits: 0,
  }).format(n);
}

function KpiCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/6 bg-[#1e293b] p-5">
      <div className={`absolute left-0 top-0 h-full w-1 ${color}`} />
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function FinancePage() {
  const [period, setPeriod] = useState("this_month");
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    setLoading(true);
    apiRequest<FinanceSummary>(`/api/v1/finance/summary?period=${period}`, {
      authToken: token,
    })
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  const margin =
    summary && summary.revenue > 0
      ? ((summary.net_profit / summary.revenue) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Finance" subtitle={summary?.period_label ?? ""} />
        <select
          aria-label="Select period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-sm text-white focus:outline-none"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Revenue"    value={fmt(summary.revenue)}    color="bg-emerald-500" />
            <KpiCard label="Expenses"   value={fmt(summary.expenses)}   color="bg-rose-500" />
            <KpiCard
              label="Net Profit"
              value={fmt(summary.net_profit)}
              color={summary.net_profit >= 0 ? "bg-blue-500" : "bg-orange-500"}
            />
            <KpiCard label="Margin" value={`${margin}%`} sub="Net profit / Revenue" color="bg-violet-500" />
          </div>

          {summary.expense_by_category.length > 0 && (
            <div className="rounded-xl border border-white/6 bg-[#1e293b] p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-300">Expenses by Category</h2>
              <div className="divide-y divide-white/6">
                {[...summary.expense_by_category]
                  .sort((a, b) => b.amount - a.amount)
                  .map((cat) => {
                    const pct =
                      summary.expenses > 0 ? (cat.amount / summary.expenses) * 100 : 0;
                    return (
                      <div key={cat.name} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                          <span className="text-sm text-slate-300">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">{pct.toFixed(1)}%</span>
                          <span className="text-sm font-medium text-white">{fmt(cat.amount)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-sm text-slate-400">No data available.</div>
      )}
    </div>
  );
}
