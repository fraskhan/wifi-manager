"use client";

import { useEffect, useState } from "react";
import { api, Plan } from "@/lib/api";
import { durationLabel, peso, speedLabel } from "@/lib/format";

const empty = { name: "", pricePesos: "", durationDays: "", durationMinutes: "", speedLimitKbps: "", description: "" };

export default function Plans() {
  const [rows, setRows] = useState<Plan[]>([]);
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await api<{ plans: Plan[] }>("/admin/plans");
    setRows(r.plans);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      await api("/admin/plans", {
        method: "POST",
        body: {
          name: form.name,
          description: form.description || undefined,
          pricePesos: Number(form.pricePesos),
          durationDays: form.durationDays ? Number(form.durationDays) : undefined,
          durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
          speedLimitKbps: form.speedLimitKbps ? Number(form.speedLimitKbps) : undefined,
        },
      });
      setForm(empty);
      await load();
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  async function toggle(p: Plan) {
    await api(`/admin/plans/${p.id}`, { method: "PATCH", body: { active: !p.active } }).catch((e) => setMsg(e.message));
    await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Plans</h1>
      {msg && <p className="text-sm text-red-400 mb-3">{msg}</p>}

      <div className="card p-5 mb-6">
        <h2 className="font-semibold mb-4">New plan</h2>
        <form onSubmit={create} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><label className="label">Name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Price (₱)</label><input className="input" type="number" min="0" step="0.01" required value={form.pricePesos} onChange={(e) => setForm({ ...form, pricePesos: e.target.value })} /></div>
          <div><label className="label">Duration (days)</label><input className="input" type="number" min="1" placeholder="or minutes →" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} /></div>
          <div><label className="label">Duration (minutes, for test plans)</label><input className="input" type="number" min="1" placeholder="e.g. 5" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} /></div>
          <div><label className="label">Speed limit (Kbps)</label><input className="input" type="number" min="0" placeholder="e.g. 10240" value={form.speedLimitKbps} onChange={(e) => setForm({ ...form, speedLimitKbps: e.target.value })} /></div>
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="sm:col-span-2 lg:col-span-3">
            <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Create plan"}</button>
          </div>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Price</th><th>Duration</th><th>Speed</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                <td>{p.name}</td>
                <td>{peso(p.price_cents)}</td>
                <td>{durationLabel(p.duration_minutes)}</td>
                <td>{speedLabel(p.speed_limit_kbps)}</td>
                <td>{p.active ? "Yes" : "No"}</td>
                <td><button className="text-xs text-[var(--accent)]" onClick={() => toggle(p)}>{p.active ? "Deactivate" : "Activate"}</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="text-slate-500 text-center py-6">No plans</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
