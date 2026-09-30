import { Router } from 'express';
import { query, withTx } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { asInt, asString, badRequest, notFound } from '../lib/validate.js';
import { authorizeUser, deauthorizeUser } from '../services/networkService.js';

const router = Router();
router.use(requireAdmin);

router.get('/stats', async (_req, res, next) => {
  try {
    const [users, active, expired, revenue, today, online] = await Promise.all([
      query("SELECT COUNT(*)::int n FROM users WHERE role = 'customer'"),
      query("SELECT COUNT(*)::int n FROM subscriptions WHERE status = 'ACTIVE' AND expires_at > now()"),
      query("SELECT COUNT(*)::int n FROM subscriptions WHERE status = 'EXPIRED'"),
      query("SELECT COALESCE(SUM(amount_cents),0)::bigint s FROM payments WHERE status = 'PAID'"),
      query("SELECT COUNT(*)::int n FROM payments WHERE status = 'PAID' AND paid_at::date = now()::date"),
      query("SELECT COUNT(*)::int n FROM network_sessions WHERE status = 'authorized'"),
    ]);
    res.json({
      customers: users.rows[0].n,
      activeSubscriptions: active.rows[0].n,
      expiredSubscriptions: expired.rows[0].n,
      revenueCents: Number(revenue.rows[0].s),
      paymentsToday: today.rows[0].n,
      onlineDevices: online.rows[0].n,
    });
  } catch (e) { next(e); }
});

router.get('/users', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const params = [];
    let where = "WHERE u.role = 'customer'";
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (u.name ILIKE $1 OR u.username ILIKE $1 OR u.mobile ILIKE $1)`;
    }
    const { rows } = await query(
      `SELECT u.id, u.name, u.mobile, u.username, u.created_at,
              (SELECT s.status FROM subscriptions s WHERE s.user_id = u.id
               ORDER BY s.created_at DESC LIMIT 1) AS last_sub_status,
              (SELECT s.expires_at FROM subscriptions s WHERE s.user_id = u.id
               AND s.status = 'ACTIVE' ORDER BY s.expires_at DESC LIMIT 1) AS active_expires_at
       FROM users u ${where} ORDER BY u.created_at DESC LIMIT 200`,
      params
    );
    res.json({ users: rows });
  } catch (e) { next(e); }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    const { rows: users } = await query(
      'SELECT id, name, mobile, username, role, created_at FROM users WHERE id = $1', [req.params.id]);
    if (!users[0]) throw notFound('User not found');
    const [subs, pays, sessions] = await Promise.all([
      query(`SELECT s.*, p.name AS plan_name, p.price_cents FROM subscriptions s
             JOIN plans p ON p.id = s.plan_id WHERE s.user_id = $1 ORDER BY s.created_at DESC`, [req.params.id]),
      query('SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC', [req.params.id]),
      query('SELECT * FROM network_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [req.params.id]),
    ]);
    res.json({ user: users[0], subscriptions: subs.rows, payments: pays.rows, sessions: sessions.rows });
  } catch (e) { next(e); }
});

router.get('/subscriptions', async (req, res, next) => {
  try {
    const status = String(req.query.status || '').toUpperCase();
    const params = [];
    let where = '';
    if (['PENDING', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(status)) {
      params.push(status);
      where = 'WHERE s.status = $1';
    }
    const { rows } = await query(
      `SELECT s.*, u.username, u.name AS user_name, p.name AS plan_name, p.price_cents
       FROM subscriptions s JOIN users u ON u.id = s.user_id JOIN plans p ON p.id = s.plan_id
       ${where} ORDER BY s.created_at DESC LIMIT 300`,
      params
    );
    res.json({ subscriptions: rows });
  } catch (e) { next(e); }
});

async function loadSub(id) {
  const { rows } = await query('SELECT * FROM subscriptions WHERE id = $1', [id]);
  if (!rows[0]) throw notFound('Subscription not found');
  return rows[0];
}

router.post('/subscriptions/:id/extend', async (req, res, next) => {
  try {
    const sub = await loadSub(req.params.id);
    const minutes = req.body?.minutes != null
      ? asInt(req.body.minutes, { min: 1, name: 'minutes' })
      : asInt(req.body?.days ?? 1, { min: 1, name: 'days' }) * 24 * 60;
    const base = sub.expires_at && new Date(sub.expires_at) > new Date() ? sub.expires_at : new Date();
    const expires = new Date(new Date(base).getTime() + minutes * 60_000);
    const { rows } = await query(
      `UPDATE subscriptions SET expires_at = $2, status = 'ACTIVE', start_at = COALESCE(start_at, now())
       WHERE id = $1 RETURNING *`,
      [sub.id, expires]
    );
    await authorizeUser(sub.user_id);
    res.json({ subscription: rows[0] });
  } catch (e) { next(e); }
});

router.post('/subscriptions/:id/suspend', async (req, res, next) => {
  try {
    const sub = await loadSub(req.params.id);
    const { rows } = await query(
      `UPDATE subscriptions SET status = 'SUSPENDED' WHERE id = $1 RETURNING *`, [sub.id]);
    await deauthorizeUser(sub.user_id);
    res.json({ subscription: rows[0] });
  } catch (e) { next(e); }
});

router.post('/subscriptions/:id/reactivate', async (req, res, next) => {
  try {
    const sub = await loadSub(req.params.id);
    if (sub.expires_at && new Date(sub.expires_at) <= new Date()) {
      throw badRequest('Subscription already expired - extend it instead');
    }
    const { rows } = await query(
      `UPDATE subscriptions SET status = 'ACTIVE' WHERE id = $1 RETURNING *`, [sub.id]);
    await authorizeUser(sub.user_id);
    res.json({ subscription: rows[0] });
  } catch (e) { next(e); }
});

router.post('/subscriptions/:id/change-plan', async (req, res, next) => {
  try {
    const sub = await loadSub(req.params.id);
    const { rows: plans } = await query('SELECT * FROM plans WHERE id = $1', [req.body?.planId]);
    if (!plans[0]) throw badRequest('Plan not found');
    const expires = new Date(Date.now() + plans[0].duration_minutes * 60_000);
    const { rows } = await query(
      `UPDATE subscriptions SET plan_id = $2, expires_at = $3 WHERE id = $1 RETURNING *`,
      [sub.id, plans[0].id, expires]
    );
    res.json({ subscription: rows[0] });
  } catch (e) { next(e); }
});

router.get('/payments', async (req, res, next) => {
  try {
    const status = String(req.query.status || '').toUpperCase();
    const params = [];
    let where = '';
    if (['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED'].includes(status)) {
      params.push(status);
      where = 'WHERE pay.status = $1';
    }
    const { rows } = await query(
      `SELECT pay.*, u.username, u.name AS user_name
       FROM payments pay JOIN users u ON u.id = pay.user_id
       ${where} ORDER BY pay.created_at DESC LIMIT 300`,
      params
    );
    res.json({ payments: rows });
  } catch (e) { next(e); }
});

router.get('/plans', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM plans ORDER BY price_cents ASC');
    res.json({ plans: rows });
  } catch (e) { next(e); }
});

router.post('/plans', async (req, res, next) => {
  try {
    const name = asString(req.body?.name, { name: 'name', max: 80 });
    const price = asInt(req.body?.priceCents ?? Math.round(Number(req.body?.pricePesos) * 100), { min: 0, name: 'price' });
    const duration = req.body?.durationMinutes != null
      ? asInt(req.body.durationMinutes, { min: 1, name: 'durationMinutes' })
      : asInt(req.body?.durationDays, { min: 1, name: 'durationDays' }) * 24 * 60;
    const speed = req.body?.speedLimitKbps ? asInt(req.body.speedLimitKbps, { min: 1 }) : null;
    const { rows } = await query(
      `INSERT INTO plans (name, description, price_cents, duration_minutes, speed_limit_kbps)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, req.body?.description || null, price, duration, speed]
    );
    res.status(201).json({ plan: rows[0] });
  } catch (e) { next(e); }
});

router.patch('/plans/:id', async (req, res, next) => {
  try {
    const { rows: cur } = await query('SELECT * FROM plans WHERE id = $1', [req.params.id]);
    if (!cur[0]) throw notFound('Plan not found');
    const p = cur[0];
    const price = req.body?.priceCents != null ? asInt(req.body.priceCents, { min: 0 })
      : req.body?.pricePesos != null ? Math.round(Number(req.body.pricePesos) * 100) : p.price_cents;
    const duration = req.body?.durationMinutes != null ? asInt(req.body.durationMinutes, { min: 1 })
      : req.body?.durationDays != null ? asInt(req.body.durationDays, { min: 1 }) * 24 * 60
      : p.duration_minutes;
    const { rows } = await query(
      `UPDATE plans SET name = $2, description = $3, price_cents = $4, duration_minutes = $5,
         speed_limit_kbps = $6, active = $7 WHERE id = $1 RETURNING *`,
      [p.id,
        req.body?.name ?? p.name,
        req.body?.description ?? p.description,
        price,
        duration,
        req.body?.speedLimitKbps !== undefined ? req.body.speedLimitKbps : p.speed_limit_kbps,
        req.body?.active !== undefined ? !!req.body.active : p.active]
    );
    res.json({ plan: rows[0] });
  } catch (e) { next(e); }
});

router.get('/network/sessions', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.*, u.username FROM network_sessions s LEFT JOIN users u ON u.id = s.user_id
       ORDER BY s.created_at DESC LIMIT 200`
    );
    res.json({ sessions: rows });
  } catch (e) { next(e); }
});

router.get('/webhook-events', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 100');
    res.json({ events: rows });
  } catch (e) { next(e); }
});

export default router;
