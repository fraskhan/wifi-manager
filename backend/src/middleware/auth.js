import { AUTH_COOKIE, verifyToken } from '../lib/tokens.js';
import { forbidden, unauthorized } from '../lib/validate.js';
import { query } from '../db.js';

export function extractToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[AUTH_COOKIE] || null;
}

export async function attachUser(req, _res, next) {
  const token = extractToken(req);
  const payload = token && verifyToken(token);
  if (payload) {
    const { rows } = await query(
      'SELECT id, name, mobile, username, role, created_at FROM users WHERE id = $1',
      [payload.sub]
    ).catch(() => ({ rows: [] }));
    req.user = rows[0] || null;
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireAdmin(req, _res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'admin') return next(forbidden('Admin access required'));
  next();
}
