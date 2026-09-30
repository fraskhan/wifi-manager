"use client";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Client-side API helper. Goes through the Next.js /api proxy -> Express. */
export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error || `Request failed (${res.status})`, json.details);
  return json as T;
}

export type Me = {
  user: { id: string; name: string; username: string; mobile?: string; role: "customer" | "admin" };
  subscription: Subscription | null;
};

export type Plan = {
  id: string; name: string; description?: string;
  price_cents: number; duration_minutes: number; speed_limit_kbps?: number | null; active?: boolean;
};

export type Subscription = {
  id: string; status: "PENDING" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
  plan_name?: string; plan_id?: string; speed_limit_kbps?: number | null;
  start_at?: string; expires_at?: string; created_at: string; price_cents?: number;
};

export type Payment = {
  id: string; provider: string; amount_cents: number; currency: string;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
  paid_at?: string; created_at: string; checkout_url?: string; subscription_id?: string;
  plan_name?: string; username?: string; user_name?: string;
};

export type Session = {
  id: string; mac?: string; ip?: string; gateway?: string; token?: string;
  status: "pending" | "authorized" | "deauthorized";
  authorized_at?: string; created_at: string; auth_url?: string; username?: string;
};

export async function getMe(): Promise<Me | null> {
  try {
    return await api<Me>("/auth/me");
  } catch {
    return null;
  }
}
