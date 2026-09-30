"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmtDate, StatusBadge } from "@/lib/format";

type Row = {
  id: string; name: string; username: string; mobile?: string; created_at: string;
  last_sub_status?: string; active_expires_at?: string;
};

export default function Customers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  async function load(search = "") {
    const r = await api<{ users: Row[] }>(`/admin/users${search ? `?q=${encodeURIComponent(search)}` : ""}`);
    setRows(r.users);
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Customers</h1>
      <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="flex gap-2 mb-4">
        <input className="input max-w-xs" placeholder="Search name / username / mobile" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-ghost">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Username</th><th>Mobile</th><th>Status</th><th>Expires</th><th>Joined</th><th></th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td className="font-mono text-xs">@{u.username}</td>
                <td>{u.mobile || "—"}</td>
                <td><StatusBadge status={u.last_sub_status} /></td>
                <td className="text-xs text-slate-400">{u.active_expires_at ? fmtDate(u.active_expires_at) : "—"}</td>
                <td className="text-xs text-slate-400">{fmtDate(u.created_at)}</td>
                <td><Link href={`/admin/customers/${u.id}`} className="text-[var(--accent)] text-xs">View</Link></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="text-slate-500 text-center py-6">No customers</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
