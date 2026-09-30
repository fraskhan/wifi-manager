import bcrypt from 'bcryptjs';
import { getDb } from './db.js';
import config from './config.js';

const PLANS = [
  { name: 'Test 5 Minutes', description: 'Development/testing plan', price_cents: 100, duration_minutes: 5, speed_limit_kbps: null },
  { name: '7 Days', description: 'Internet access for 7 days', price_cents: 10000, duration_minutes: 7 * 24 * 60, speed_limit_kbps: 5120 },
  { name: '15 Days', description: 'Internet access for 15 days', price_cents: 18000, duration_minutes: 15 * 24 * 60, speed_limit_kbps: 5120 },
  { name: '30 Days', description: 'Internet access for 30 days', price_cents: 30000, duration_minutes: 30 * 24 * 60, speed_limit_kbps: 10240 },
  { name: '60 Days', description: 'Internet access for 60 days', price_cents: 55000, duration_minutes: 60 * 24 * 60, speed_limit_kbps: 10240 },
  { name: '90 Days', description: 'Internet access for 90 days', price_cents: 75000, duration_minutes: 90 * 24 * 60, speed_limit_kbps: 20480 },
];

export async function seedIfEmpty() {
  const { pool } = await getDb();

  const { rows: adminRows } = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!adminRows.length) {
    const hash = await bcrypt.hash(config.admin.password, 10);
    await pool.query(
      `INSERT INTO users (name, username, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
      [config.admin.name, config.admin.username, hash]
    );
    console.log(`[seed] admin user created: ${config.admin.username}`);
  }

  const { rows: planRows } = await pool.query('SELECT COUNT(*)::int AS n FROM plans');
  if (planRows[0].n === 0) {
    for (const p of PLANS) {
      await pool.query(
        `INSERT INTO plans (name, description, price_cents, duration_minutes, speed_limit_kbps)
         VALUES ($1, $2, $3, $4, $5)`,
        [p.name, p.description, p.price_cents, p.duration_minutes, p.speed_limit_kbps]
      );
    }
    console.log(`[seed] ${PLANS.length} plans created`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedIfEmpty()
    .then(() => { console.log('[seed] done'); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
