/**
 * End-to-end smoke test (in-memory DB, no network needed):
 *   register -> subscribe -> simulate captive client -> pay (mock) ->
 *   ACTIVE + authorized -> force expiry -> EXPIRED + deauthorized -> admin stats.
 */
import { createApp } from '../src/app.js';
import { getDb } from '../src/db.js';
import { sweepExpiredSubscriptions } from '../src/services/networkService.js';
import config from '../src/config.js';

const jar = new Map();
const cookies = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(';');
    const [k, ...v] = pair.split('=');
    jar.set(k.trim(), v.join('='));
  }
}

let base;
async function api(path, { method = 'GET', body, headers = {}, asAdmin } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookies(), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  storeCookies(res);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function check(name, cond, extra = '') {
  if (!cond) { console.error(`FAIL ${name} ${extra}`); process.exit(1); }
  console.log(`ok   ${name}`);
}

const { inMemory } = await getDb();
const app = createApp();
const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
base = `http://127.0.0.1:${server.address().port}`;
console.log(`smoke: db=${inMemory ? 'in-memory' : 'postgres'} base=${base}`);

let r = await api('/api/health');
check('health', r.json.ok === true);

const uname = `user${Date.now().toString(36)}`;
r = await api('/api/auth/register', { method: 'POST', body: { name: 'Juan Dela Cruz', mobile: '09171234567', username: uname, password: 'secret123' } });
check('register', r.status === 201 && r.json.user?.username === uname, JSON.stringify(r.json));

r = await api('/api/plans');
check('plans', r.json.plans?.length >= 1);
const testPlan = r.json.plans.find((p) => p.duration_minutes <= 60) || r.json.plans[0];

r = await api('/api/subscriptions', { method: 'POST', body: { planId: testPlan.id } });
check('subscribe creates checkout', r.status === 201 && r.json.payment?.checkout_url, JSON.stringify(r.json));
const payment = r.json.payment;

r = await api('/api/network/simulate-connect', { method: 'POST', body: {} });
check('simulate captive client', r.status === 201 && r.json.session?.status === 'pending');
const sessionToken = r.json.session.token;

r = await api(`/api/payments/${payment.id}/test-success`, { method: 'POST' });
check('test payment success', r.status === 200 && r.json.payment?.status === 'PAID', JSON.stringify(r.json));
check('subscription activated', r.json.subscription?.status === 'ACTIVE');

r = await api('/api/network/status');
check('network online after payment', r.json.online === true, JSON.stringify(r.json));
check('session authorized', r.json.sessions?.[0]?.status === 'authorized');

r = await api(`/api/network/session/${sessionToken}`);
check('session lookup', r.status === 200);

// Force expiry, then run the sweeper like the cron does.
const { pool } = await getDb();
await pool.query(`UPDATE subscriptions SET expires_at = now() - interval '1 minute' WHERE status = 'ACTIVE'`);
const expired = await sweepExpiredSubscriptions();
check('sweep expired', expired.length >= 1);

r = await api('/api/network/status');
check('offline after expiry', r.json.online === false);
check('session deauthorized', r.json.sessions?.[0]?.status === 'deauthorized');

r = await api('/api/auth/logout', { method: 'POST' });
jar.clear();
r = await api('/api/auth/login', { method: 'POST', body: { username: config.admin.username, password: config.admin.password } });
check('admin login', r.status === 200 && r.json.user?.role === 'admin', JSON.stringify(r.json));

r = await api('/api/admin/stats');
check('admin stats', r.status === 200 && r.json.customers >= 1 && r.json.expiredSubscriptions >= 1, JSON.stringify(r.json));

r = await api('/api/fas/test-vector');
check('fas test vector', r.status === 200 && r.json.url, JSON.stringify(r.json));

server.close();
console.log('\nAll smoke checks passed.');
process.exit(0);
