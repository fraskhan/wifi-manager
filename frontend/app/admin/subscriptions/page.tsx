"use client";

import { useEffect, useState } from "react";
import { api, Subscription } from "@/lib/api";
import { fmtDate, peso, StatusBadge } from "@/lib/format";

const FILTERS = ["", "ACTIVE", "PENDING", "EXPIRED", "SUSPENDED", "CANCELLED"];
type Row = Subscription & { username: string; user_name: string };

export default function Subscriptions() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState("");

  async function load(status = filter) {
    const r = await api<{ subscriptions: Row[] }>(`/admin/subscriptions${status ? `?status=${status}` : ""}`);
    setRows(r.subscriptions);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  async function act(id: string, action: string, body?: unknown) {
    setMsg("");
    try { await api(`/admin/subscriptions/${id}/${action}`, { method: "POST", body }); await load(); }
    catch (e: any) { setMsg(e.message); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Subscriptions</h1>
      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button key={f || "all"} onClick={() => setFilter(f)}
            className={`btn text-xs !py-1.5 ${filter === f ? "btn-primary" : "btn-ghost"}`}>
            {f || "All"}
          </button>
        ))}
      </div>
      {msg && <p className="text-sm text-red-400 mb-3">{msg}</p>}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Started</th><th>Expires</th><th>Price</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.user_name}<div className="text-xs text-slate-500 font-mono">@{s.username}</div></td>
                <td>{s.plan_name}</td>
                <td><StatusBadge status={s.status} /></td>
                <td className="text-xs text-slate-400">{fmtDate(s.start_at)}</td>
                <td className="text-xs text-slate-400">{fmtDate(s.expires_at)}</td>
                <td>{s.price_cents != null ? peso(s.price_cents) : "—"}</td>
                <td className="text-xs space-x-2 whitespace-nowrap">
                  <button className="text-[var(--accent)]" onClick={() => act(s.id, "extend", { days: 30 })}>+30d</button>
                  <button className="text-emerald-400" onClick={() => act(s.id, "reactivate")}>Activate</button>
                  <button className="text-orange-400" onClick={() => act(s.id, "suspend")}>Suspend</button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="text-slate-500 text-center py-6">No subscriptions</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
