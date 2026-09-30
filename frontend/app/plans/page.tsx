"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Plan } from "@/lib/api";
import { peso, durationLabel, speedLabel } from "@/lib/format";

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api<{ plans: Plan[] }>("/plans").then((r) => setPlans(r.plans)).catch((e) => setError(e.message));
  }, []);

  async function subscribe(planId: string) {
    setBusyId(planId); setError("");
    try {
      const r = await api<{ payment: { checkout_url: string } }>("/subscriptions", {
        method: "POST", body: { planId },
      });
      // checkout_url points at the provider's hosted checkout (mock page in dev).
      window.location.href = r.payment.checkout_url;
    } catch (e: any) {
      setBusyId(null);
      if (e.status === 401) router.push("/login?next=/plans");
      else setError(e.message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">Choose a plan</h1>
      <p className="text-slate-400 text-sm mb-8">Internet access turns on right after payment and expires automatically.</p>
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans?.map((p) => (
          <div key={p.id} className="card p-6 flex flex-col">
            <div className="text-3xl font-bold">{peso(p.price_cents)}</div>
            <div className="text-lg font-semibold mt-1">{p.name}</div>
            <ul className="text-slate-400 text-sm mt-3 space-y-1 flex-1">
              <li>Duration: {durationLabel(p.duration_minutes)}</li>
              <li>Speed: {speedLabel(p.speed_limit_kbps)}</li>
              {p.description && <li>{p.description}</li>}
            </ul>
            <button className="btn btn-primary mt-5" disabled={busyId === p.id} onClick={() => subscribe(p.id)}>
              {busyId === p.id ? "Creating checkout…" : "Subscribe"}
            </button>
          </div>
        ))}
        {plans === null && !error && <p className="text-slate-500">Loading…</p>}
      </div>
    </div>
  );
}
