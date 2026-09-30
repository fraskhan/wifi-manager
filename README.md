# Wi-Fi Manager — Prepaid Wi-Fi System

Prepaid Wi-Fi captive-portal system built on **OpenWrt + openNDS** (network gate)
and **Next.js + Node.js/Express + PostgreSQL/Supabase** (business logic).

```
 PLDT ──> Huawei HG8145X6-10 ──> OpenWrt router (openNDS captive portal)
                                        │
                                   Customer Wi-Fi
                                        │
                                  Captive portal ──> THIS APP
                                        │
                        Next.js frontend ─┼─ Express backend ──> PostgreSQL (Supabase)
                                        │
                                   Payment (GCash/Maya via PayMongo)
```

**OpenWrt/openNDS controls the network. This app controls the business logic.**

## Repo layout

| Path | What |
|---|---|
| `frontend/` | Next.js + Tailwind — customer portal, plans, checkout, dashboard, admin UI |
| `backend/` | Node.js + Express API — auth, subscriptions, payments, network control, openNDS FAS |
| `backend/migrations/` | PostgreSQL schema (run once on Supabase) |
| `supabase/` | Same migration in Supabase CLI layout |

## Quick start (local, no database needed)

```bash
npm install
npm run dev:backend     # http://localhost:4000  (in-memory Postgres, auto-seeded)
npm run dev:frontend    # http://localhost:3000
```

Seed data (dev): admin login `admin` / `admin123`, plans ₱100–₱750 + a ₱1 / 5-minute test plan.

End-to-end self-check:

```bash
npm run smoke
```

## Connecting your Supabase project

1. Create a project at https://supabase.com (your dedicated account).
2. Run the schema: Supabase Dashboard → **SQL Editor** → paste `backend/migrations/0001_init.sql` → Run.
   (Or `supabase db push` using `supabase/migrations/`.)
3. `backend/.env` (copy from `.env.example`):

```env
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
JWT_SECRET=<64 random hex>
```

   Get the URI from Supabase → **Project Settings → Database → Connection string**.
4. `npm run migrate --workspace backend && npm run seed --workspace backend`

That's the whole "online" part — frontend, backend and database all live outside the router.

## Payments

- `PAYMENT_PROVIDER=mock` (default): checkout goes to a built-in test page with
  **Simulate Success / Fail** — exercises the entire subscribe → activate → expire
  pipeline without real money (PHASE 4 of the plan).
- `PAYMENT_PROVIDER=paymongo`: real GCash/Maya/card via PayMongo Checkout.
  Set `PAYMONGO_SECRET_KEY` + `PAYMONGO_WEBHOOK_SECRET`; point the webhook at
  `https://api.yourdomain.com/api/payments/webhook`.

Payments never touch the router directly — the provider webhook hits the backend,
the backend flips `subscriptions.status = ACTIVE`, and the network layer releases
the device.

## openNDS / OpenWrt wiring

On the OpenWrt router:

```sh
opkg install opennds
uci set opennds.faskey='<same as OPENNDS_FAS_KEY>'
uci set opennds.fas_secure_enabled='1'
uci set opennds.fasremoteip='<api server ip>'
uci set opennds.fasurl='https://api.yourdomain.com/api/fas'
uci set opennds.faspath='/api/fas'
uci commit opennds && service opennds restart
```

Flow: client connects → openNDS redirects browser to `GET /api/fas?fas=...&iv=...`
→ backend decrypts (AES-256-CBC, key = SHA-256 of `faskey`), records a pending
`network_sessions` row, 302s to `${PORTAL_BASE_URL}/portal?session=<token>`.
When the customer's subscription is ACTIVE the portal calls
`POST /api/network/connect-session` and then redirects the device to the gateway
auth URL (`auth_url` on the session) — openNDS releases the MAC onto the Internet.

`fas_secure_enabled='0'` sends the same fields as plaintext params — also supported.

> Verify `authdir`/token format against your installed openNDS version; the payload
> is stored raw in `network_sessions.fas_payload` for debugging.

## API surface

```
POST /api/auth/register|login|logout      GET /api/auth/me
GET  /api/plans
GET  /api/subscriptions/me                POST /api/subscriptions
POST /api/payments/create                 GET  /api/payments/:id   GET /api/payments/me
POST /api/payments/webhook                (raw body, provider-verified)
POST /api/payments/:id/test-success|fail  (mock provider only)
GET  /api/network/status                  POST /api/network/simulate-connect
GET  /api/network/session/:token          POST /api/network/connect-session
POST /api/network/authorize|deauthorize   (x-api-key: NETWORK_API_KEY)
GET  /api/fas   GET /api/fas/test-vector
GET  /api/admin/stats|users|subscriptions|payments|plans|network/sessions|webhook-events
POST /api/admin/subscriptions/:id/extend|suspend|reactivate|change-plan
POST /api/admin/plans                     PATCH /api/admin/plans/:id
GET  /api/admin/users/:id
```

## Test the expiry path

Subscribe to **Test 5 Minutes (₱1)** → mock-pay it → `/dashboard` shows ACTIVE.
Within ~5 minutes the 30-second sweeper marks it EXPIRED and deauthorizes the
session — the device falls back behind the portal.

## Manual mode (no router hardware)

Until an openNDS gateway exists, run in **manual mode**: customers pay, and the
dashboard/portal reveals the actual Wi-Fi password you set in
**Admin → Settings**. Customers get online by joining the Huawei Wi-Fi with
that password. Rotate the password periodically.

## Deploy (Render + Vercel, free)

1. Push this repo to GitHub.
2. **Backend → Render**: New → Blueprint → select repo (uses `render.yaml`).
   Fill the `sync:false` env vars: `DATABASE_URL` (Supabase), `JWT_SECRET`,
   `NETWORK_API_KEY`, `PAYMONGO_*` (live keys), `ADMIN_PASSWORD`,
   `PORTAL_BASE_URL`/`FRONTEND_URL`/`PAYMONGO_*_URL` = your Vercel domain.
   `SEED_ON_BOOT=true` seeds admin + plans once.
3. **Frontend → Vercel**: Import repo → **root directory `frontend/`** →
   env `BACKEND_URL=https://<render-service>.onrender.com` → Deploy.
4. **PayMongo live**: switch dashboard to live mode → `sk_live_` key into
   `PAYMONGO_SECRET_KEY` → create a **live-mode webhook** at
   `https://<render-service>.onrender.com/api/payments/webhook` → `whsk_` into
   `PAYMONGO_WEBHOOK_SECRET`.
5. Set `wifi_ssid` + `wifi_password` in **Admin → Settings** (manual mode), or
   point openNDS `fasurl` at the Render API once you have the gateway hardware.

Free Render services sleep when idle — first request after idle takes ~30s.
