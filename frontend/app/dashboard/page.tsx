"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getMe, Me, Session, Subscription } from "@/lib/api";
import { fmtDate, peso, speedLabel, StatusBadge, timeLeft } from "@/lib/format";

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [history, setHistory] = useState<Subscription[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const m = await getMe();
    if (!m) { router.push("/login?next=/dashboard"); return; }
    setMe(m);
    const [subs, net] = await Promise.all([
      api<{ history: Subscription[] }>("/subscriptions/me").catch(() => ({ history: [] })),
      api<{ sessions: Session[] }>("/network/status").catch(() => ({ sessions: [] })),
    ]);
    setHistory(subs.history);
    setSessions(net.sessions);
    setLoaded(true);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Refresh periodically so expiry flips on screen.
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  }

  if (!me) return <div className="max-w-4xl mx-auto px-4 py-16 text-slate-400">{loaded ? "Redirecting…" : "Loading…"}</div>;

  const sub = me.subscription;
  const left = timeLeft(sub?.expires_at);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Hi, {me.user.name}</h1>
          <p className="text-sm text-slate-400">@{me.user.username}</p>
        </div>
        <button onClick={logout} className="btn btn-ghost text-sm">Log out</button>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">Subscription</div>
            <StatusBadge status={sub ? "ACTIVE" : "EXPIRED"} />
            {sub && (
              <>
                <div className="text-lg font-semibold mt-3">{sub.plan_name}</div>
                <div className="text-sm text-slate-400">Speed: {speedLabel(sub.speed_limit_kbps)}</div>
              </>
            )}
          </div>
          {sub && (
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Expires</div>
              <div className="font-semibold">{fmtDate(sub.expires_at)}</div>
              <div className="text-sm text-[var(--accent)] mt-1">{left.label} remaining</div>
            </div>
          )}
        </div>
        {!sub && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Your Internet access has expired or isn&apos;t active yet.
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <Link href="/plans" className="btn btn-primary">{sub ? "Renew plan" : "Subscribe now"}</Link>
          <button className="btn btn-ghost" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold mb-4">Devices</h2>
          {sessions.length ? (
            <ul className="space-y-2 text-sm">
              {sessions.slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-center justify-between border-b border-[#16203a] pb-2">
                  <span className="text-slate-300 font-mono text-xs">{s.mac || s.ip || "device"}</span>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No devices connected. Join the Wi-Fi and the portal will appear here.</p>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold mb-4">History</h2>
          {history.length ? (
            <ul className="space-y-2 text-sm">
              {history.slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-center justify-between border-b border-[#16203a] pb-2">
                  <div>
                    <span className="text-slate-300">{s.plan_name}</span>
                    <span className="text-slate-500 text-xs ml-2">{s.price_cents != null ? peso(s.price_cents) : ""}</span>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No subscriptions yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
