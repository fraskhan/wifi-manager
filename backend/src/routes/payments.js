import { Router } from 'express';
import config from '../config.js';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { forbidden, notFound } from '../lib/validate.js';
import { createSubscriptionCheckout, handleWebhook, markFailed, markPaid } from '../services/paymentService.js';
import { verifyWebhookSignature, parseWebhook } from '../services/payments/paymongo.js';

const router = Router();

/**
 * POST /api/payments/webhook — mounted with express.raw() in app.js so the
 * provider signature can be verified over the raw body.
 */
export async function webhookHandler(req, res) {
  const providerName = config.paymentProvider;
  const rawBody = req.body?.toString?.() ?? '';

  if (providerName === 'paymongo') {
    const sig = req.headers['paymongo-signature'];
    if (!verifyWebhookSignature(rawBody, sig)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    const parsed = parseWebhook(rawBody);
    if (!parsed?.eventId) return res.status(200).json({ received: true });
    const result = await handleWebhook('paymongo', { ...parsed, payload: JSON.parse(rawBody) });
    return res.status(result.error ? 500 : 200).json(result);
  }

  // Unknown provider in webhook context — accept and ignore.
  res.status(200).json({ received: true });
}

router.use(requireAuth);

router.post('/create', async (req, res, next) => {
  try {
    const result = await createSubscriptionCheckout(req.user.id, req.body?.planId);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

router.get('/me', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, provider, amount_cents, currency, status, paid_at, created_at, subscription_id
       FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ payments: rows });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT pay.*, p.name AS plan_name, p.duration_minutes
       FROM payments pay
       LEFT JOIN subscriptions s ON s.id = pay.subscription_id
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE pay.id = $1`,
      [req.params.id]
    );
    const payment = rows[0];
    if (!payment) throw notFound('Payment not found');
    if (payment.user_id !== req.user.id && req.user.role !== 'admin') throw forbidden();
    res.json({ payment });
  } catch (e) { next(e); }
});

/**
 * PHASE 4 test hooks — simulate the provider's "payment succeeded/failed"
 * callback. Only available for the mock provider (or explicitly allowed).
 */
function testHooksEnabled(req, _res, next) {
  if (!config.allowTestPayments && config.paymentProvider !== 'mock') {
    return next(forbidden('Test payment hooks are disabled'));
  }
  next();
}

router.post('/:id/test-success', testHooksEnabled, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT user_id FROM payments WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('Payment not found');
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') throw forbidden();
    const result = await markPaid(req.params.id);
    res.json(result);
  } catch (e) { next(e); }
});

router.post('/:id/test-fail', testHooksEnabled, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT user_id FROM payments WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('Payment not found');
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') throw forbidden();
    const payment = await markFailed(req.params.id);
    res.json({ payment });
  } catch (e) { next(e); }
});

export default router;
