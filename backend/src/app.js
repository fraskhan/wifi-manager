import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import config from './config.js';
import { attachUser } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import planRoutes from './routes/plans.js';
import subscriptionRoutes from './routes/subscriptions.js';
import paymentRoutes, { webhookHandler } from './routes/payments.js';
import networkRoutes from './routes/network.js';
import fasRoutes from './routes/fas.js';
import adminRoutes from './routes/admin.js';
import { getDb } from './db.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(cookieParser());

  // Payment webhooks need the RAW body for signature verification.
  app.post('/api/payments/webhook', express.raw({ type: '*/*' }), webhookHandler);

  app.use(express.json({ limit: '256kb' }));

  app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));

  app.use(attachUser);

  app.get('/api/health', async (_req, res) => {
    const { inMemory } = await getDb();
    res.json({ ok: true, provider: config.paymentProvider, db: inMemory ? 'in-memory' : 'postgres' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/plans', planRoutes);
  app.use('/api/subscriptions', subscriptionRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/network', networkRoutes);
  app.use('/api/fas', fasRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
