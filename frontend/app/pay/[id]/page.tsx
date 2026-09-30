"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Payment } from "@/lib/api";
import { peso, durationLabel } from "@/lib/format";

/**
 * Mock hosted checkout (PHASE 4). In production this page is replaced by the
 * real provider's checkout URL (PayMongo GCash/Maya). The buttons simulate the
 * provider's success/failure callback.
 */
export default function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [payment, setPayment] = useState<(Payment & { plan_name?: string; duration_minutes?: number }) | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ payment: any }>(`/payments/${id}`)
      .then((r) => setPayment(r.payment))
      .catch((e) => setError(e.message));
  }, [id]);

  async function decide(success: boolean) {
    setBusy(true); setError("");
    try {
      await api(`/payments/${id}/${success ? "test-success" : "test-fail"}`, { method: "POST" });
      router.push(`/payment/result?status=${success ? "success" : "failed"}`);
    } catch (e: any) {
      setError(e.message); setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <div className="card p-6">
        <div className="text-xs font-semibold tracking-widest text-amber-400 uppercase mb-3">
          Test checkout — no real money
        </div>
        <h1 className="text-xl font-bold mb-4">Complete payment</h1>
        {payment ? (
          <>
            <div className="rounded-lg bg-[#0d1526] border border-[var(--card-border)] p-4 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">{payment.plan_name || "Subscription"}</span>
                <span>{payment.duration_minutes ? durationLabel(payment.duration_minutes) : ""}</span>
              </div>
              <div className="text-3xl font-bold mt-2">{peso(payment.amount_cents)}</div>
              <div className="text-xs text-slate-500 mt-1">Ref: {payment.provider}-{payment.id.slice(0, 8)}</div>
            </div>
            {payment.status === "PENDING" ? (
              <div className="space-y-2">
                <button className="btn btn-primary w-full" disabled={busy} onClick={() => decide(true)}>
                  {busy ? "Processing…" : "Simulate successful payment"}
                </button>
                <button className="btn btn-ghost w-full" disabled={busy} onClick={() => decide(false)}>
                  Simulate failed payment
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center">This payment is already {payment.status}.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400">{error || "Loading…"}</p>
        )}
        {error && payment && <p className="text-sm text-red-400 mt-3">{error}</p>}
      </div>
    </div>
  );
}
