import { createApp } from './app.js';
import { getDb } from './db.js';
import { startJobs } from './services/jobs.js';
import config from './config.js';

const { inMemory } = await getDb();
const app = createApp();
startJobs();

app.listen(config.port, () => {
  console.log(`Wi-Fi Manager API listening on http://localhost:${config.port}`);
  console.log(`  db=${inMemory ? 'in-memory (dev)' : 'postgres'} provider=${config.paymentProvider}`);
});
