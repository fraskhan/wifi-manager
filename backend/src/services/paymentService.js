import config from '../config.js';
import { withTx, query } from '../db.js';
import { badRequest, notFound, conflict } from '../lib/validate.js';
import * as mockProvider from './payments/mock.js';
import * as paymongoProvider from './payments/paymongo.js';
import { authorizeUser } from './networkService.js';

const providers = { mock: mockProvider, paymongo: paymongoProvider };
export const provider = providers[config.paymentProvider] || mockProvider;

/**
 * Create a PENDING subscription + PENDING payment and a provider checkout.
 * Payment is what activates the subscription - never trust the frontend's
 * "success" page alone; activation happens in markPaid() via webhook or
 * verified test hook.
 */
export async function createSubscriptionCheckout(userId, planId) {
  const { rows: plans } = await query('SELECT * FROM plans WHERE id = $1 AND active = true', [planId]);
  const plan = plans[0];
  if (!plan) throw badRequest('Plan not found or inactive');

  const { subscription, payment } = await withTx(async (client) => {
    const { rows: subs } = await client.query(
      `INSERT INTO subscriptions (user_id, plan_id, status) VALUES ($1, $2, 'PENDING') RETURNING *`,
      [userId, plan.id]
    );
    const { rows: pays } = await client.query(
      `INSERT INTO payments (user_id, subscription_id, provider, amount_cents, currency)
       VALUES ($1, $2, $3, $4, 'PHP') RETURNING *`,
      [userId, subs[0].id, config.paymentProvider, plan.price_cents]
    );
    return { subscription: subs[0], payment: pays[0] };
  });

  const checkout = await provider.createCheckout({ payment, plan });
  const { rows } = await query(
    `UPDATE payments SET provider_payment_id = $2, checkout_url = $3 WHERE id = $1 RETURNING *`,
    [payment.id, checkout.provider_payment_id, checkout.checkout_url]
  );
  return { subscription, payment: rows[0], plan };
}

/**
 * Mark a payment PAID and activate the linked subscription.
 * Transactional + idempotent: safe to call twice (e.g. duplicate webhooks).
 */
export async function markPaid(paymentId, { providerRef = null } = {}) {
  const result = await withTx(async (client) => {
    const { rows: pays } = await client.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
    const payment = pays[0];
    if (!payment) throw notFound('Payment not found');
    if (payment.status === 'PAID') return { payment, subscription: null, alreadyPaid: true };
    if (payment.status !== 'PENDING') throw conflict(`Payment is ${payment.status}`);

    const { rows: updated } = await client.query(
      `UPDATE payments SET status = 'PAID', paid_at = now(), provider_payment_id = COALESCE($2, provider_payment_id)
       WHERE id = $1 RETURNING *`,
      [paymentId, providerRef]
    );

    const { rows: subs } = await client.query(
      `SELECT s.*, p.duration_minutes FROM subscriptions s JOIN plans p ON p.id = s.plan_id
       WHERE s.id = $1`,
      [payment.subscription_id]
    );
    let subscription = subs[0];
    if (subscription && subscription.status !== 'CANCELLED') {
      const expiresAt = new Date(Date.now() + subscription.duration_minutes * 60_000);
      const { rows: act } = await client.query(
        `UPDATE subscriptions SET status = 'ACTIVE', start_at = now(), expires_at = $2
         WHERE id = $1 RETURNING *`,
        [subscription.id, expiresAt]
      );
      subscription = act[0];
    }

    // Ensure the user has a network account (username = portal username).
    await client.query(
      `INSERT INTO network_accounts (user_id, username)
       SELECT u.id, u.username FROM users u WHERE u.id = $1
       ON CONFLICT (user_id) DO NOTHING`,
      [payment.user_id]
    );

    return { payment: updated[0], subscription, alreadyPaid: false };
  });

  if (!result.alreadyPaid) {
    // Client devices already held captive get released immediately.
    await authorizeUser(result.payment.user_id);
  }
  return result;
}

export async function markFailed(paymentId) {
  const { rows } = await query(
    `UPDATE payments SET status = 'FAILED' WHERE id = $1 AND status = 'PENDING' RETURNING *`,
    [paymentId]
  );
  if (rows[0]?.subscription_id) {
    await query(
      `UPDATE subscriptions SET status = 'CANCELLED' WHERE id = $1 AND status = 'PENDING'`,
      [rows[0].subscription_id]
    );
  }
  return rows[0] || null;
}

/**
 * Provider webhook entry point. Records the event for dedupe, verifies it,
 * then activates on success. Returns {handled, duplicate, error}.
 */
export async function handleWebhook(providerName, { eventId, eventType, payload, referenceNumber, providerPaymentId, paid }) {
  // Record once; UNIQUE(provider, event_id) makes duplicate deliveries no-ops.
  const { rows: inserted } = await query(
    `INSERT INTO webhook_events (provider, event_id, event_type, payload)
     VALUES ($1, $2, $3, $4) ON CONFLICT (provider, event_id) DO NOTHING RETURNING id`,
    [providerName, eventId, eventType || null, payload ? JSON.stringify(payload) : null]
  );
  if (!inserted.length) return { handled: false, duplicate: true };

  let error = null;
  if (paid) {
    try {
      let paymentId = referenceNumber;
      if (!paymentId && providerPaymentId) {
        const { rows } = await query(
          'SELECT id FROM payments WHERE provider = $1 AND provider_payment_id = $2',
          [providerName, providerPaymentId]
        );
        paymentId = rows[0]?.id;
      }
      if (!paymentId) throw badRequest('Webhook missing payment reference');
      await markPaid(paymentId, { providerRef: providerPaymentId });
    } catch (e) {
      error = String(e.message || e);
    }
  }

  await query(
    'UPDATE webhook_events SET processed = $2, processed_at = now() WHERE provider = $3 AND event_id = $1',
    [eventId, !error, providerName]
  );
  return { handled: !error, duplicate: false, error };
}
