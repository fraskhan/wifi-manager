export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function badRequest(msg, details) { return new ApiError(400, msg, details); }
export function unauthorized(msg = 'Not authenticated') { return new ApiError(401, msg); }
export function forbidden(msg = 'Not allowed') { return new ApiError(403, msg); }
export function notFound(msg = 'Not found') { return new ApiError(404, msg); }
export function conflict(msg) { return new ApiError(409, msg); }

export function requireFields(body, fields) {
  const missing = fields.filter((f) => body?.[f] == null || body[f] === '');
  if (missing.length) throw badRequest(`Missing fields: ${missing.join(', ')}`, { missing });
}

export function asString(v, { min = 1, max = 255, name = 'value' } = {}) {
  if (typeof v !== 'string') throw badRequest(`${name} must be a string`);
  const s = v.trim();
  if (s.length < min) throw badRequest(`${name} is too short (min ${min})`);
  if (s.length > max) throw badRequest(`${name} is too long (max ${max})`);
  return s;
}

export function asInt(v, { min, max, name = 'value' } = {}) {
  const n = Number(v);
  if (!Number.isInteger(n)) throw badRequest(`${name} must be an integer`);
  if (min != null && n < min) throw badRequest(`${name} must be >= ${min}`);
  if (max != null && n > max) throw badRequest(`${name} must be <= ${max}`);
  return n;
}
