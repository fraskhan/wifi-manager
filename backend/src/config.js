import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load backend/.env no matter where node was launched from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const bool = (v, dflt = false) => (v == null || v === '' ? dflt : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  databaseUrl: process.env.DATABASE_URL || '',

  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
  allowTestPayments: bool(process.env.ALLOW_TEST_PAYMENTS, true),

  paymongo: {
    secretKey: process.env.PAYMONGO_SECRET_KEY || '',
    webhookSecret: process.env.PAYMONGO_WEBHOOK_SECRET || '',
    successUrl: process.env.PAYMONGO_SUCCESS_URL || '',
    cancelUrl: process.env.PAYMONGO_CANCEL_URL || '',
  },

  networkApiKey: process.env.NETWORK_API_KEY || 'dev-network-key-change-me',
  openndsFasKey: process.env.OPENNDS_FAS_KEY || '',
  portalBaseUrl: process.env.PORTAL_BASE_URL || 'http://localhost:3000',

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    name: process.env.ADMIN_NAME || 'Administrator',
  },
};

export const isProd = config.nodeEnv === 'production';
if (isProd && config.jwtSecret === 'dev-only-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}

export default config;
