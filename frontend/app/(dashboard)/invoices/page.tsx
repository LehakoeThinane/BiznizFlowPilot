"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";

interface InvoiceListItem {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  status: string;
  issue_date: string;
  due_date: string | null;
  total_amount: number;
}

interface InvoiceListResponse { items: InvoiceListItem[]; total: number }

function fmt(n: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency", currency: "ZAR", maximumFractionDigits: 0,
  }).format(n);
}

function statusColor(s: string) {
  if (s === "paid")      return "bg-emerald-500/20 text-emerald-300";
  if (s === "sent")      return "bg-blue-500/20 text-blue-300";
  if (s === "overdue")   return "bg-rose-500/20 text-rose-300";
  if (s === "draft")     return "bg-slate-500/30 text-slate-400";
  if (s === "cancelled") return "bg-orange-500/20 text-orange-300";
  return "bg-white/10 text-slate-300";
}

const STATUS_FILTERS = ["all", "draft", "sent", "paid", "overdue", "cancelled"];

export default function InvoicesPage() {
  const [items, setItems] = useState<InvoiceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = filter !== "all" ? `&status=${filter}` : "";
    apiRequest<InvoiceListResponse>(`/api/v1/invoices?limit=50${qs}`, {
      authToken: getStoredToken(),
    })
      .then((d) => {
        setItems(d.items ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  const totalValue = items.reduce((s, i) => s + Number(i.total_amount), 0);
  const outstanding = items
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.total_amount), 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Invoices" subtitle={`${total} invoices`} />

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Value",  value: fmt(totalValue),  color: "bg-blue-500" },
          { label: "Outstanding",  value: fmt(outstanding), color: "bg-orange-500" },
          { label: "Count",        value: String(total),    color: "bg-violet-500" },
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
              filter === s
                ? "bg-blue-600 text-white"
                : "bg-white/4 text-slate-400 hover:bg-white/8"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-white/6 bg-[#1e293b]">
        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-400">No invoices found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/6 text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">Invoice #</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Issue Date</th>
                <th className="px-3 py-3 font-medium">Due Date</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {items.map((inv) => (
                <tr key={inv.id} className="hover:bg-white/2">
                  <td className="px-5 py-3 font-mono text-xs text-slate-300">{inv.invoice_number}</td>
                  <td className="px-3 py-3 text-white">{inv.customer_name ?? "—"}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-400">{inv.issue_date}</td>
                  <td className="px-3 py-3 text-slate-400">{inv.due_date ?? "—"}</td>
                  <td className="px-5 py-3 text-right font-medium text-white">{fmt(Number(inv.total_amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
