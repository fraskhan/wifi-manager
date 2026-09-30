import { getDb, runMigrations } from './db.js';

await getDb();
await runMigrations();
console.log('[migrate] all migrations applied');
process.exit(0);
