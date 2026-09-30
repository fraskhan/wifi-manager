"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await api<{ user: { role: string } }>("/auth/login", { method: "POST", body: { username, password } });
      if (r.user.role !== "admin") { setError("This account is not an admin"); setBusy(false); return; }
      router.push("/admin");
      router.refresh();
    } catch (e: any) {
      setError(e.message); setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <div className="card p-6">
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Admin</div>
        <h1 className="text-xl font-bold mb-6">Sign in</h1>
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
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}
