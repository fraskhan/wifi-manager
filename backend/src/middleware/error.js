import { ApiError } from '../lib/validate.js';
import { isProd } from '../config.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found', path: req.path });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  console.error('[error]', err);
  res.status(500).json({ error: isProd ? 'Internal server error' : String(err?.message || err) });
}
