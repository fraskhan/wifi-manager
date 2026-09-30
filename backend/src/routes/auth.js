import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { AUTH_COOKIE, signToken } from '../lib/tokens.js';
import { requireAuth } from '../middleware/auth.js';
import { asString, badRequest, conflict, unauthorized, requireFields } from '../lib/validate.js';
import { isProd } from '../config.js';
import { getActiveSubscription } from '../services/networkService.js';

const router = Router();

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/',
  });
}

const publicUser = (u) => ({ id: u.id, name: u.name, mobile: u.mobile, username: u.username, role: u.role });

router.post('/register', async (req, res, next) => {
  try {
    requireFields(req.body, ['name', 'username', 'password']);
    const name = asString(req.body.name, { name: 'name', max: 120 });
    const username = asString(req.body.username, { name: 'username', min: 3, max: 40 })
      .toLowerCase();
    if (!/^[a-z0-9_.-]+$/.test(username)) throw badRequest('username may only contain letters, numbers, _ . -');
    const mobile = req.body.mobile ? asString(req.body.mobile, { name: 'mobile', max: 32 }) : null;
    const password = asString(req.body.password, { name: 'password', min: 6, max: 128 });

    const { rows: existing } = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.length) throw conflict('Username is already taken');

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (name, mobile, username, password_hash) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, mobile, username, hash]
    );
    const user = rows[0];
    await query(
      'INSERT INTO network_accounts (user_id, username) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
      [user.id, user.username]
    );

    const token = signToken(user);
    setAuthCookie(res, token);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    requireFields(req.body, ['username', 'password']);
    const username = String(req.body.username).trim().toLowerCase();
    const { rows } = await query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    const ok = user && (await bcrypt.compare(String(req.body.password), user.password_hash));
    if (!ok) throw unauthorized('Invalid username or password');
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ token, user: publicUser(user) });
  } catch (e) { next(e); }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const subscription = await getActiveSubscription(req.user.id);
    res.json({ user: publicUser(req.user), subscription });
  } catch (e) { next(e); }
});

export default router;
