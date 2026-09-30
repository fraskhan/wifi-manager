import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import config from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool = null;
let inMemory = false;

async function createPool() {
  if (config.databaseUrl) {
    const { default: pg } = await import('pg');
    // Supabase (and most hosted Postgres) require TLS.
    const needsSsl = !/localhost|127\.0\.0\.1/.test(config.databaseUrl);
    return {
      pool: new pg.Pool({
        connectionString: config.databaseUrl,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      }),
      inMemory: false,
    };
  }

  // Local development fallback: in-memory PostgreSQL.
  const { newDb, DataType } = await import('pg-mem');
  const mem = newDb({ noAstCoverageCheck: true });
  try {
    mem.public.registerFunction({
      name: 'gen_random_uuid',
      returns: DataType.uuid,
      implementation: () => crypto.randomUUID(),
      impure: true,
    });
  } catch { /* already provided by pg-mem */ }
  const adapter = mem.adapters.createPg();
  return { pool: new adapter.Pool(), inMemory: true };
}

export async function getDb() {
  if (!pool) {
    const created = await createPool();
    pool = created.pool;
    inMemory = created.inMemory;
    if (inMemory) {
      console.warn('[db] DATABASE_URL not set - using in-memory PostgreSQL (data resets on restart)');
      await runMigrations();
      await runSeed();
    }
  }
  return { pool, inMemory };
}

export async function query(text, params) {
  const { pool } = await getDb();
  return pool.query(text, params);
}

export async function withTx(fn) {
  const { pool } = await getDb();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function migrationsDir() {
  const candidates = [
    process.env.MIGRATIONS_DIR,
    path.join(__dirname, '..', 'migrations'),
    path.join(__dirname, '..', '..', 'supabase', 'migrations'),
  ].filter(Boolean);
  const dir = candidates.find((d) => fs.existsSync(d));
  if (!dir) throw new Error('No migrations directory found');
  return dir;
}

export async function runMigrations() {
  const { pool } = await getDb();
  const dir = migrationsDir();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id serial PRIMARY KEY, name text NOT NULL UNIQUE, applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
    console.log(`[db] migration applied: ${file}`);
  }
  return files.length;
}

async function runSeed() {
  const { seedIfEmpty } = await import('./seed.js');
  await seedIfEmpty();
}
