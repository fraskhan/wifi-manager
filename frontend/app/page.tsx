"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Plan } from "@/lib/api";
import { peso, durationLabel, speedLabel } from "@/lib/format";

export default function Home() {
  const [plans, setPlans] = useState<Plan[]>([]);
  useEffect(() => {
    api<{ plans: Plan[] }>("/plans").then((r) => setPlans(r.plans)).catch(() => {});
  }, []);

  return (
    <div>
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <p className="text-[var(--accent)] text-sm font-semibold tracking-widest uppercase mb-4">
          Prepaid Wi-Fi Access
        </p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Fast Internet.
          <br />
          <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] bg-clip-text text-transparent">
            Pay as you go.
          </span>
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto mb-8">
          Connect to MyWiFi, pick a plan, pay with GCash or Maya, and you&apos;re online.
          No contracts, no monthly bills.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/register" className="btn btn-primary">Get connected</Link>
          <Link href="/plans" className="btn btn-ghost">View plans</Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        <h2 className="text-xl font-semibold mb-6 text-center">Plans</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className="card p-6 flex flex-col">
              <div className="text-2xl font-bold">{peso(p.price_cents)}</div>
              <div className="text-lg font-semibold mt-1">{p.name}</div>
              <div className="text-slate-400 text-sm mt-1 flex-1">
                {durationLabel(p.duration_minutes)} · {speedLabel(p.speed_limit_kbps)}
              </div>
              <Link href={`/plans`} className="btn btn-primary mt-4">Subscribe</Link>
            </div>
          ))}
          {!plans.length && <p className="text-slate-500 col-span-full text-center">Loading plans…</p>}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-20">
        <h2 className="text-xl font-semibold mb-6 text-center">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          {[
            ["1. Connect", "Join the MyWiFi network — the portal opens automatically."],
            ["2. Subscribe", "Create an account and choose a plan."],
            ["3. Pay & surf", "Pay via GCash/Maya. Internet turns on instantly and expires automatically."],
          ].map(([t, d]) => (
            <div key={t} className="card p-5">
              <div className="font-semibold mb-1 text-[var(--accent)]">{t}</div>
              <div className="text-slate-400">{d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
