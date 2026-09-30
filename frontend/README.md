# frontend

Next.js (App Router) + Tailwind UI for the Wi-Fi Manager: customer portal,
plans, mock checkout, customer dashboard, and the `/admin` management UI.

`next.config.ts` proxies `/api/*` to the Express backend (`BACKEND_URL`,
default `http://localhost:4000`) so auth cookies stay first-party.

See the [root README](../README.md) for architecture and setup.
