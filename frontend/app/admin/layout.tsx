"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { api, getMe } from "@/lib/api";

const NAV = [
  ["Dashboard", "/admin"],
  ["Customers", "/admin/customers"],
  ["Subscriptions", "/admin/subscriptions"],
  ["Payments", "/admin/payments"],
  ["Plans", "/admin/plans"],
  ["Network", "/admin/network"],
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    getMe().then((m) => {
      if (!m || m.user.role !== "admin") router.replace("/admin/login");
      else { setName(m.user.name); setOk(true); }
    });
  }, [router]);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/admin/login");
  }

  if (pathname === "/admin/login") return <>{children}</>;
  if (!ok) return <div className="max-w-6xl mx-auto px-4 py-16 text-slate-400">Loading…</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
      <aside className="w-48 shrink-0">
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">Admin</div>
        <nav className="space-y-1">
          {NAV.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2 rounded-lg text-sm ${
                pathname === href ? "bg-[var(--card)] text-white font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 pt-4 border-t border-[var(--card-border)]">
          <div className="text-xs text-slate-500 mb-2">{name}</div>
          <button onClick={logout} className="text-xs text-slate-400 hover:text-white">Log out</button>
        </div>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
