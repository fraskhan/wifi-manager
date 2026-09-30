-- Wi-Fi Manager initial schema
-- Compatible with PostgreSQL 14+ (incl. Supabase) and pg-mem for local dev.

CREATE TABLE IF NOT EXISTS schema_migrations (
  id         serial PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  mobile        text,
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  description      text,
  price_cents      integer NOT NULL CHECK (price_cents >= 0),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  speed_limit_kbps integer,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id    uuid NOT NULL REFERENCES plans(id),
  status     text NOT NULL DEFAULT 'PENDING'
             CHECK (status IN ('PENDING', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED')),
  start_at   timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry ON subscriptions(status, expires_at);

CREATE TABLE IF NOT EXISTS payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id     uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  provider            text NOT NULL,
  provider_payment_id text,
  checkout_url        text,
  amount_cents        integer NOT NULL CHECK (amount_cents >= 0),
  currency            text NOT NULL DEFAULT 'PHP',
  status              text NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED')),
  paid_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_ref
  ON payments(provider, provider_payment_id);

-- Per-user network credential. In production this maps to the account the
-- router/openNDS uses to authorize a device onto the Internet.
CREATE TABLE IF NOT EXISTS network_accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  username   text NOT NULL UNIQUE,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tracks physical client sessions (a phone/laptop held captive by openNDS).
CREATE TABLE IF NOT EXISTS network_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  mac             text,
  ip              text,
  gateway         text,
  token           text UNIQUE,
  fas_payload     jsonb,
  auth_url        text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'authorized', 'deauthorized')),
  authorized_at   timestamptz,
  deauthorized_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON network_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_mac ON network_sessions(mac);

-- Payment-provider webhook dedupe/audit log.
CREATE TABLE IF NOT EXISTS webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text NOT NULL,
  event_id     text NOT NULL,
  event_type   text,
  payload      jsonb,
  processed    boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, event_id)
);
