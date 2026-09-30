import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { createSubscriptionCheckout } from '../services/paymentService.js';
import { getActiveSubscription } from '../services/networkService.js';

const router = Router();
router.use(requireAuth);

router.get('/me', async (req, res, next) => {
  try {
    const active = await getActiveSubscription(req.user.id);
    const { rows: history } = await query(
      `SELECT s.id, s.status, s.start_at, s.expires_at, s.created_at,
              p.name AS plan_name, p.price_cents, p.speed_limit_kbps
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({ active, history });
  } catch (e) { next(e); }
});

/** Subscribe to a plan: creates PENDING subscription + payment checkout. */
router.post('/', async (req, res, next) => {
  try {
    const { planId } = req.body || {};
    const result = await createSubscriptionCheckout(req.user.id, planId);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

export default router;
