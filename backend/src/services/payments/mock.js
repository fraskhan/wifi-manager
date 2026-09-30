import crypto from 'node:crypto';
import config from '../../config.js';

/**
 * Mock payment provider (PHASE 4 in the build plan).
 * Creates a payment whose "hosted checkout" is our own test page where you can
 * click SUCCESS / FAIL - no real money involved.
 */
export async function createCheckout({ payment, plan }) {
  const providerRef = `mock_${crypto.randomBytes(8).toString('hex')}`;
  return {
    provider_payment_id: providerRef,
    checkout_url: `${config.frontendUrl}/pay/${payment.id}?ref=${providerRef}`,
  };
}

/** Mock provider sends no webhooks - the test page hits /api/payments/:id/test-* instead. */
export function parseWebhook() {
  return null;
}
