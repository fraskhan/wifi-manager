import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MyWiFi — Prepaid Internet",
  description: "Prepaid Wi-Fi access. Subscribe, pay, get online.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-[var(--card-border)]">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-bold text-lg tracking-tight">
              <span className="text-[var(--accent)]">My</span>WiFi
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-300">
              <Link href="/plans" className="hover:text-white">Plans</Link>
              <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
              <Link href="/login" className="btn-ghost btn !py-1.5">Log in</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--card-border)] py-6 text-center text-xs text-slate-500">
          MyWiFi Prepaid Internet
        </footer>
      </body>
    </html>
  );
}
