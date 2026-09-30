"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await api<{ user: { role: string } }>("/auth/login", {
        method: "POST", body: { username, password },
      });
      router.push(r.user.role === "admin" ? "/admin" : next);
      router.refresh();
    } catch (e: any) {
      setError(e.message); setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <div className="card p-6">
        <h1 className="text-xl font-bold mb-1">Welcome back</h1>
        <p className="text-sm text-slate-400 mb-6">Log in to manage your subscription.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Username</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
        </form>
        <p className="text-sm text-slate-400 mt-4 text-center">
          No account?{" "}
          <Link href={`/register?next=${encodeURIComponent(next)}`} className="text-[var(--accent)]">Register</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
