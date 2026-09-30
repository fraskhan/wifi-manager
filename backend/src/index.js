import { createApp } from './app.js';
import { getDb, runMigrations } from './db.js';
import { seedIfEmpty } from './seed.js';
import { startJobs } from './services/jobs.js';
import config from './config.js';

const { inMemory } = await getDb();
await runMigrations(); // idempotent — tracks schema_migrations
// In-memory dev already seeds inside getDb(); for real DBs seed only when asked.
if (!inMemory && process.env.SEED_ON_BOOT === 'true') await seedIfEmpty();

const app = createApp();
startJobs();

app.listen(config.port, () => {
  console.log(`Wi-Fi Manager API listening on http://localhost:${config.port}`);
  console.log(`  db=${inMemory ? 'in-memory (dev)' : 'postgres'} provider=${config.paymentProvider}`);
});
