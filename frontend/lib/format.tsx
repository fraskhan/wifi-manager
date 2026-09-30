export function peso(cents: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(cents / 100);
}

export function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-PH", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes % (24 * 60) === 0) {
    const d = minutes / (24 * 60);
    return `${d} day${d === 1 ? "" : "s"}`;
  }
  const h = minutes / 60;
  return `${h} hour${h === 1 ? "" : "s"}`;
}

export function timeLeft(expiresAt?: string | null): { label: string; ms: number } {
  if (!expiresAt) return { label: "—", ms: 0 };
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { label: "expired", ms: 0 };
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  if (days >= 1) return { label: `${days} day${days === 1 ? "" : "s"}`, ms };
  const hours = Math.floor(mins / 60);
  if (hours >= 1) return { label: `${hours}h ${mins % 60}m`, ms };
  return { label: `${mins}m`, ms };
}

export function speedLabel(kbps?: number | null): string {
  if (!kbps) return "Best effort";
  return kbps >= 1000 ? `${kbps / 1000} Mbps` : `${kbps} Kbps`;
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  PAID: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  authorized: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  EXPIRED: "bg-red-500/15 text-red-300 border-red-500/30",
  FAILED: "bg-red-500/15 text-red-300 border-red-500/30",
  SUSPENDED: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  CANCELLED: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  deauthorized: "bg-red-500/15 text-red-300 border-red-500/30",
  REFUNDED: "bg-sky-500/15 text-sky-300 border-sky-500/30",
};

export function StatusBadge({ status }: { status?: string | null }) {
  const s = status || "—";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${STATUS_STYLE[s] || STATUS_STYLE.CANCELLED}`}>
      {s}
    </span>
  );
}
