"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, Payment, Plan, Session, Subscription } from "@/lib/api";
import { fmtDate, peso, StatusBadge } from "@/lib/format";

type Detail = {
  user: { id: string; name: string; username: string; mobile?: string; created_at: string };
  subscriptions: Subscription[]; payments: Payment[]; sessions: Session[];
};

export default function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const [d, p] = await Promise.all([
      api<Detail>(`/admin/users/${id}`),
      api<{ plans: Plan[] }>("/admin/plans"),
    ]);
    setData(d); setPlans(p.plans);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function action(subId: string, act: string, body?: unknown) {
    setMsg("");
    try {
      await api(`/admin/subscriptions/${subId}/${act}`, { method: "POST", body });
      await load();
    } catch (e: any) { setMsg(e.message); }
  }

  if (!data) return <p className="text-slate-400">Loading…</p>;
  const { user } = data;

  return (
    <div>
      <Link href="/admin/customers" className="text-xs text-slate-400 hover:text-white">← Customers</Link>
      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-bold">{user.name}</h1>
        <p className="text-sm text-slate-400">@{user.username} · {user.mobile || "no mobile"} · joined {fmtDate(user.created_at)}</p>
      </div>
      {msg && <p className="text-sm text-red-400 mb-4">{msg}</p>}

      <div className="card p-5 mb-6">
        <h2 className="font-semibold mb-3">Subscriptions</h2>
        <table className="table">
          <thead><tr><th>Plan</th><th>Status</th><th>Expires</th><th>Price</th><th>Actions</th></tr></thead>
          <tbody>
            {data.subscriptions.map((s) => (
              <tr key={s.id}>
                <td>{s.plan_name}</td>
                <td><StatusBadge status={s.status} /></td>
                <td className="text-xs text-slate-400">{fmtDate(s.expires_at)}</td>
                <td>{s.price_cents != null ? peso(s.price_cents) : "—"}</td>
                <td className="space-x-2 text-xs whitespace-nowrap">
                  <button className="text-[var(--accent)]" onClick={() => action(s.id, "extend", { days: 30 })}>+30d</button>
                  {s.status === "SUSPENDED" || s.status === "EXPIRED" ? (
                    <button className="text-emerald-400" onClick={() => action(s.id, "reactivate")}>Reactivate</button>
                  ) : (
                    <button className="text-orange-400" onClick={() => action(s.id, "suspend")}>Suspend</button>
                  )}
                  <select
                    className="bg-[#0d1526] border border-[var(--card-border)] rounded px-1 py-0.5"
                    value=""
                    onChange={(e) => e.target.value && action(s.id, "change-plan", { planId: e.target.value })}
                  >
                    <option value="">Plan…</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {!data.subscriptions.length && <tr><td colSpan={5} className="text-slate-500 text-center py-4">None</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Payments</h2>
          <table className="table">
            <thead><tr><th>Amount</th><th>Status</th><th>Provider</th><th>Date</th></tr></thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td>{peso(p.amount_cents)}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className="text-xs">{p.provider}</td>
                  <td className="text-xs text-slate-400">{fmtDate(p.paid_at || p.created_at)}</td>
                </tr>
              ))}
              {!data.payments.length && <tr><td colSpan={4} className="text-slate-500 text-center py-4">None</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Network sessions</h2>
          <table className="table">
            <thead><tr><th>Device</th><th>IP</th><th>Status</th><th>When</th></tr></thead>
            <tbody>
              {data.sessions.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.mac || "—"}</td>
                  <td className="font-mono text-xs">{s.ip || "—"}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td className="text-xs text-slate-400">{fmtDate(s.created_at)}</td>
                </tr>
              ))}
              {!data.sessions.length && <tr><td colSpan={4} className="text-slate-500 text-center py-4">None</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
