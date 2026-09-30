import jwt from 'jsonwebtoken';
import config from '../config.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, username: user.username }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

export const AUTH_COOKIE = 'wm_token';
