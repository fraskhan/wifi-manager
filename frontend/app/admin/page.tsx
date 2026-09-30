"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { peso } from "@/lib/format";

type Stats = {
  customers: number; activeSubscriptions: number; expiredSubscriptions: number;
  revenueCents: number; paymentsToday: number; onlineDevices: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { api<Stats>("/admin/stats").then(setStats).catch(() => {}); }, []);

  const cards: [string, string][] = stats ? [
    ["Customers", String(stats.customers)],
    ["Active subscriptions", String(stats.activeSubscriptions)],
    ["Expired subscriptions", String(stats.expiredSubscriptions)],
    ["Online devices", String(stats.onlineDevices)],
    ["Revenue", peso(stats.revenueCents)],
    ["Payments today", String(stats.paymentsToday)],
  ] : [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-5">
            <div className="text-xs uppercase tracking-widest text-slate-500">{label}</div>
            <div className="text-2xl font-bold mt-2">{value}</div>
          </div>
        ))}
        {!stats && <p className="text-slate-500">Loading…</p>}
      </div>
    </div>
  );
}
