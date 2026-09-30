"use client";

import { useEffect, useState } from "react";
import { api, Payment } from "@/lib/api";
import { fmtDate, peso, StatusBadge } from "@/lib/format";

const FILTERS = ["", "PAID", "PENDING", "FAILED", "REFUNDED"];

export default function Payments() {
  const [rows, setRows] = useState<Payment[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api<{ payments: Payment[] }>(`/admin/payments${filter ? `?status=${filter}` : ""}`)
      .then((r) => setRows(r.payments)).catch(() => {});
  }, [filter]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Payments</h1>
      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button key={f || "all"} onClick={() => setFilter(f)}
            className={`btn text-xs !py-1.5 ${filter === f ? "btn-primary" : "btn-ghost"}`}>
            {f || "All"}
          </button>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>ID</th><th>Customer</th><th>Amount</th><th>Provider</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.id.slice(0, 8)}</td>
                <td>{p.user_name}<div className="text-xs text-slate-500 font-mono">@{p.username}</div></td>
                <td>{peso(p.amount_cents)}</td>
                <td className="text-xs">{p.provider}</td>
                <td><StatusBadge status={p.status} /></td>
                <td className="text-xs text-slate-400">{fmtDate(p.paid_at || p.created_at)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="text-slate-500 text-center py-6">No payments</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
