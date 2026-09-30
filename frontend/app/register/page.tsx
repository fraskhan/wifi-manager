"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/plans";
  const [form, setForm] = useState({ name: "", mobile: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/auth/register", { method: "POST", body: form });
      router.push(next);
      router.refresh();
    } catch (e: any) {
      setError(e.message); setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <div className="card p-6">
        <h1 className="text-xl font-bold mb-1">Create account</h1>
        <p className="text-sm text-slate-400 mb-6">Register to subscribe to a plan.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={form.name} onChange={set("name")} autoFocus required />
          </div>
          <div>
            <label className="label">Mobile number</label>
            <input className="input" value={form.mobile} onChange={set("mobile")} placeholder="09xx xxx xxxx" />
          </div>
          <div>
            <label className="label">Username</label>
            <input className="input" value={form.username} onChange={set("username")} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={form.password} onChange={set("password")} required minLength={6} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        </form>
        <p className="text-sm text-slate-400 mt-4 text-center">
          Already registered?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-[var(--accent)]">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>;
}
