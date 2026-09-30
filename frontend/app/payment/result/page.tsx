"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function Result() {
  const status = useSearchParams().get("status") || "";
  const ok = status === "success";
  return (
    <div className="max-w-sm mx-auto px-4 py-20 text-center">
      <div className={`card p-8 ${ok ? "" : ""}`}>
        <div className={`text-5xl mb-4 ${ok ? "text-emerald-400" : "text-red-400"}`}>{ok ? "✓" : "✕"}</div>
        <h1 className="text-xl font-bold mb-2">{ok ? "Payment successful" : "Payment failed"}</h1>
        <p className="text-sm text-slate-400 mb-6">
          {ok
            ? "Your subscription is now active. If your device was on the portal, Internet access has been enabled."
            : "The payment was not completed. No subscription was activated."}
        </p>
        <div className="flex gap-2 justify-center">
          <Link href="/dashboard" className="btn btn-primary">Go to dashboard</Link>
          {!ok && <Link href="/plans" className="btn btn-ghost">Try again</Link>}
        </div>
      </div>
    </div>
  );
}

export default function PaymentResult() {
  return <Suspense><Result /></Suspense>;
}
