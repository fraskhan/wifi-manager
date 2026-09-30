"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, getMe, Session } from "@/lib/api";

/**
 * Captive portal landing. openNDS bounces the device here via /api/fas with
 * ?session=<token>. The device logs in; if its account has an ACTIVE
 * subscription we authorize the session and send it to the gateway auth URL
 * (openNDS releases the MAC). Otherwise we push subscribe/pay.
 */
function Portal() {
  const params = useSearchParams();
  const token = params.get("session") || "";
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<any>(null);
  const [state, setState] = useState<"loading" | "need-login" | "need-sub" | "online" | "error">("loading");
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ ssid: string; password: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [s, m] = await Promise.all([
          token ? api<{ session: Session }>(`/network/session/${token}`).catch(() => null) : null,
          getMe(),
        ]);
        setSession(s?.session || null);
        setMe(m);
        if (!m) return setState("need-login");
        if (!m.subscription) return setState("need-sub");
        // Active subscription — authorize this device session.
        if (token) {
          const r = await api<{ session: Session }>(`/network/connect-session`, {
            method: "POST", body: { token },
          });
          setSession(r.session);
          setAuthUrl(r.session.auth_url || null);
        }
        // Manual mode: no gateway → just hand over the Wi-Fi credentials.
        const c = await api<{ ssid: string; password: string }>("/network/credentials").catch(() => null);
        setCreds(c);
        setState("online");
      } catch (e: any) {
        setError(e.message); setState("error");
      }
    })();
  }, [token]);

  const back = `/portal?session=${encodeURIComponent(token)}`;

  return (
    <div className="max-w-sm mx-auto px-4 py-12">
      <div className="card p-6 text-center">
        <div className="text-lg font-bold mb-1"><span className="text-[var(--accent)]">My</span>WiFi</div>
        <p className="text-xs text-slate-500 mb-6">Captive portal</p>

        {state === "loading" && <p className="text-slate-400 text-sm">Checking your access…</p>}

        {state === "need-login" && (
          <>
            <p className="text-sm text-slate-300 mb-1 font-semibold">Internet Access</p>
            <p className="text-sm text-slate-400 mb-5">Please log in or subscribe to continue.</p>
            <div className="space-y-2">
              <Link href={`/login?next=${encodeURIComponent(back)}`} className="btn btn-primary w-full">Log in</Link>
              <Link href={`/register?next=${encodeURIComponent(back)}`} className="btn btn-ghost w-full">Create account</Link>
            </div>
          </>
        )}

        {state === "need-sub" && (
          <>
            <p className="text-sm text-slate-300 mb-1 font-semibold">No active subscription</p>
            <p className="text-sm text-slate-400 mb-5">Choose a plan and pay to get online instantly.</p>
            <Link href={`/plans?next=${encodeURIComponent(back)}`} className="btn btn-primary w-full">View plans</Link>
          </>
        )}

        {state === "online" && (
          <>
            <div className="text-4xl text-emerald-400 mb-3">✓</div>
            <p className="font-semibold mb-1">You&apos;re online</p>
            <p className="text-sm text-slate-400 mb-5">
              {me?.subscription?.plan_name} · expires{" "}
              {me?.subscription?.expires_at ? new Date(me.subscription.expires_at).toLocaleDateString("en-PH") : "—"}
            </p>
            {authUrl ? (
              <a href={authUrl} className="btn btn-primary w-full">Continue to Internet</a>
            ) : creds ? (
              <div className="text-left rounded-lg bg-[#0d1526] border border-[var(--card-border)] p-4 text-sm">
                <div className="label">Wi-Fi network</div>
                <div className="font-mono font-bold mb-2">{creds.ssid || "—"}</div>
                <div className="label">Password</div>
                <div className="font-mono font-bold">{creds.password || "—"}</div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Session authorized — you can browse now.</p>
            )}
          </>
        )}

        {state === "error" && <p className="text-sm text-red-400">{error}</p>}

        {session && (
          <div className="mt-6 pt-4 border-t border-[var(--card-border)] text-xs text-slate-500 space-y-0.5 text-left">
            {session.mac && <div>Device: <span className="font-mono">{session.mac}</span></div>}
            {session.ip && <div>IP: <span className="font-mono">{session.ip}</span></div>}
            <div>Status: {session.status}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortalPage() {
  return <Suspense><Portal /></Suspense>;
}
