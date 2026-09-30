import { Router } from 'express';
import config from '../config.js';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { forbidden, notFound } from '../lib/validate.js';
import {
  authorizeSession, authorizeUser, createSession, deauthorizeUser,
  getActiveSubscription, getSessionByToken, networkStatusForUser,
} from '../services/networkService.js';

const router = Router();

/** Signed-in customer: is my Internet on, and what sessions exist? */
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    res.json(await networkStatusForUser(req.user.id));
  } catch (e) { next(e); }
});

/**
 * Manual mode (no gateway hardware): ACTIVE subscribers get the Wi-Fi
 * credentials to connect manually. Revealed only after payment.
 */
router.get('/credentials', requireAuth, async (req, res, next) => {
  try {
    const subscription = await getActiveSubscription(req.user.id);
    if (!subscription) return res.status(402).json({ error: 'Active subscription required' });
    const { rows } = await query(
      `SELECT key, value FROM app_settings WHERE key IN ('wifi_ssid','wifi_password','wifi_instructions')`
    );
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({ ssid: s.wifi_ssid || '', password: s.wifi_password || '', instructions: s.wifi_instructions || '' });
  } catch (e) { next(e); }
});

/**
 * Dev tool: pretend a device just connected to Wi-Fi and got captured by the
 * portal. Creates the same pending session openNDS would via /api/fas.
 */
router.post('/simulate-connect', async (req, res, next) => {
  try {
    const session = await createSession({
      userId: req.user?.id ?? null,
      mac: req.body?.mac || `02:00:${[...Array(4)].map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':')}`,
      ip: req.body?.ip || `10.1.0.${Math.floor(Math.random() * 200) + 20}`,
      gateway: 'dev-gateway',
    });
    res.status(201).json({ session, portal_url: `${config.portalBaseUrl}/portal?session=${session.token}` });
  } catch (e) { next(e); }
});

/** Look up the pending session a captive portal landing page is showing. */
router.get('/session/:token', async (req, res, next) => {
  try {
    const session = await getSessionByToken(req.params.token);
    if (!session) throw notFound('Session not found');
    res.json({ session });
  } catch (e) { next(e); }
});

/**
 * Called by the portal after login/subscription check: if the signed-in user
 * has an ACTIVE subscription, authorize the pending session on the gateway.
 */
router.post('/connect-session', requireAuth, async (req, res, next) => {
  try {
    const session = await getSessionByToken(String(req.body?.token || ''));
    if (!session) throw notFound('Session not found');
    const subscription = await getActiveSubscription(req.user.id);
    if (!subscription) return res.status(402).json({ error: 'No active subscription', session });
    const updated = await authorizeSession(session.id);
    await query('UPDATE network_sessions SET user_id = $1 WHERE id = $2', [req.user.id, session.id]);
    res.json({ session: updated, subscription });
  } catch (e) { next(e); }
});

/* ---------- Controller/gateway API (shared-secret auth) ---------- */

function requireNetworkKey(req, _res, next) {
  if (req.headers['x-api-key'] !== config.networkApiKey) return next(unauthorizedKey());
  next();
}
const unauthorizedKey = () => Object.assign(new Error('Invalid x-api-key'), { status: 401 });

router.post('/authorize', requireNetworkKey, async (req, res, next) => {
  try {
    const { userId, sessionToken } = req.body || {};
    let sessions = [];
    if (sessionToken) {
      const found = await getSessionByToken(sessionToken);
      if (!found) throw notFound('Session not found');
      const s = await authorizeSession(found.id);
      sessions = s ? [s] : [];
    } else if (userId) {
      sessions = await authorizeUser(userId);
    }
    res.json({ authorized: sessions });
  } catch (e) { next(e); }
});

router.post('/deauthorize', requireNetworkKey, async (req, res, next) => {
  try {
    const sessions = await deauthorizeUser(req.body?.userId);
    res.json({ deauthorized: sessions });
  } catch (e) { next(e); }
});

export default router;
