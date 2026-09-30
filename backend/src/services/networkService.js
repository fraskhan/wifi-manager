import crypto from 'node:crypto';
import { query, withTx } from '../db.js';

/**
 * Network control layer.
 *
 * Production: the gateway (OpenWrt/openNDS) holds clients captive until the
 * FAS endpoint authorizes them (see routes/fas.js). This module is the single
 * place that decides "is this user allowed on the Internet right now?" and
 * records per-device sessions.
 *
 * Local dev: /api/network/simulate-connect creates a pending session the same
 * way openNDS would, so the full flow can be exercised without hardware.
 */

export async function getActiveSubscription(userId) {
  const { rows } = await query(
    `SELECT s.*, p.name AS plan_name, p.speed_limit_kbps
     FROM subscriptions s JOIN plans p ON p.id = s.plan_id
     WHERE s.user_id = $1 AND s.status = 'ACTIVE' AND s.expires_at > now()
     ORDER BY s.expires_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

/** Called when a device is held by the captive portal (via FAS or simulation). */
export async function createSession({ userId = null, mac = null, ip = null, gateway = null }) {
  const token = crypto.randomBytes(24).toString('hex');
  const { rows } = await query(
    `INSERT INTO network_sessions (user_id, mac, ip, gateway, token)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, mac, ip, gateway, token]
  );
  return rows[0];
}

export async function getSessionByToken(token) {
  const { rows } = await query('SELECT * FROM network_sessions WHERE token = $1', [token]);
  return rows[0] || null;
}

export async function attachUserToSession(sessionId, userId) {
  const { rows } = await query(
    'UPDATE network_sessions SET user_id = $2 WHERE id = $1 RETURNING *',
    [sessionId, userId]
  );
  return rows[0];
}

/** Grant a session Internet access (used by FAS flow). */
export async function authorizeSession(sessionId) {
  const { rows } = await query(
    `UPDATE network_sessions SET status = 'authorized', authorized_at = now()
     WHERE id = $1 RETURNING *`,
    [sessionId]
  );
  return rows[0] || null;
}

/** Grant Internet access for every pending session belonging to a user (post-payment). */
export async function authorizeUser(userId) {
  const { rows } = await query(
    `UPDATE network_sessions SET status = 'authorized', authorized_at = now()
     WHERE user_id = $1 AND status = 'pending' RETURNING *`,
    [userId]
  );
  await query('UPDATE network_accounts SET last_login = now() WHERE user_id = $1', [userId]);
  return rows;
}

export async function deauthorizeUser(userId) {
  const { rows } = await query(
    `UPDATE network_sessions SET status = 'deauthorized', deauthorized_at = now()
     WHERE user_id = $1 AND status = 'authorized' RETURNING *`,
    [userId]
  );
  return rows;
}

/** Expire ACTIVE subscriptions past their expiry and kick their users off. */
export async function sweepExpiredSubscriptions() {
  return withTx(async (client) => {
    const { rows: expired } = await client.query(
      `UPDATE subscriptions SET status = 'EXPIRED'
       WHERE status = 'ACTIVE' AND expires_at <= now() RETURNING id, user_id`
    );
    for (const sub of expired) {
      await client.query(
        `UPDATE network_sessions SET status = 'deauthorized', deauthorized_at = now()
         WHERE user_id = $1 AND status = 'authorized'`,
        [sub.user_id]
      );
    }
    return expired;
  });
}

export async function networkStatusForUser(userId) {
  const subscription = await getActiveSubscription(userId);
  const { rows: sessions } = await query(
    `SELECT id, mac, ip, gateway, status, authorized_at, created_at
     FROM network_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [userId]
  );
  return { online: !!subscription, subscription, sessions };
}
