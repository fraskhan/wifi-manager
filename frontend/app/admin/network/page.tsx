"use client";

import { useEffect, useState } from "react";
import { api, Session } from "@/lib/api";
import { fmtDate, StatusBadge } from "@/lib/format";

export default function Network() {
  const [rows, setRows] = useState<Session[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await api<{ sessions: Session[] }>("/admin/network/sessions");
    setRows(r.sessions);
  }
  useEffect(() => { load(); }, []);

  // Dev helper: pretend a device joined Wi-Fi and got captured by the portal.
  async function simulate() {
    setBusy(true); setMsg("");
    try {
      const r = await api<{ session: Session; portal_url: string }>("/network/simulate-connect", { method: "POST" });
      setMsg(`Pending session created: ${r.session.mac} → open ${r.portal_url}`);
      await load();
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  const online = rows.filter((s) => s.status === "authorized").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Network</h1>
        <button className="btn btn-ghost text-sm" disabled={busy} onClick={simulate}>
          Simulate captive client
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="card p-5"><div className="text-xs uppercase tracking-widest text-slate-500">Online</div><div className="text-2xl font-bold mt-2">{online}</div></div>
        <div className="card p-5"><div className="text-xs uppercase tracking-widest text-slate-500">Captive</div><div className="text-2xl font-bold mt-2">{rows.filter((s) => s.status === "pending").length}</div></div>
        <div className="card p-5"><div className="text-xs uppercase tracking-widest text-slate-500">Total sessions</div><div className="text-2xl font-bold mt-2">{rows.length}</div></div>
      </div>
      {msg && <p className="text-xs text-slate-400 mb-4 font-mono break-all">{msg}</p>}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>User</th><th>MAC</th><th>IP</th><th>Gateway</th><th>Status</th><th>Authorized</th><th>Created</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs">{s.username ? `@${s.username}` : "—"}</td>
                <td className="font-mono text-xs">{s.mac || "—"}</td>
                <td className="font-mono text-xs">{s.ip || "—"}</td>
                <td className="text-xs">{s.gateway || "—"}</td>
                <td><StatusBadge status={s.status} /></td>
                <td className="text-xs text-slate-400">{fmtDate(s.authorized_at)}</td>
                <td className="text-xs text-slate-400">{fmtDate(s.created_at)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="text-slate-500 text-center py-6">No sessions</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
