import crypto from 'node:crypto';
import config from '../../config.js';
import { ApiError } from '../../lib/validate.js';

/**
 * PayMongo checkout provider (GCash / Maya / card) for production use.
 * Docs: https://developers.paymongo.com/reference/checkout-api
 *
 * Flow: createCheckout -> customer pays on PayMongo-hosted page ->
 * PayMongo calls POST /api/payments/webhook -> markPaid.
 */

const API = 'https://api.paymongo.com/v1';

export async function createCheckout({ payment, plan }) {
  if (!config.paymongo.secretKey) throw new ApiError(500, 'PAYMONGO_SECRET_KEY not configured');
  const auth = Buffer.from(`${config.paymongo.secretKey}:`).toString('base64');
  const res = await fetch(`${API}/checkout_sessions`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          cancel_url: config.paymongo.cancelUrl,
          success_url: config.paymongo.successUrl,
          payment_method_types: ['gcash', 'paymaya', 'card'],
          reference_number: payment.id,
          description: `Wi-Fi subscription: ${plan.name}`,
          line_items: [
            { currency: 'PHP', amount: payment.amount_cents, name: plan.name, quantity: 1 },
          ],
        },
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(502, `PayMongo error: ${res.status}`, body);
  const session = body.data;
  return {
    provider_payment_id: session.id,
    checkout_url: session.attributes.checkout_url,
  };
}

/**
 * Verify Paymongo-Signature header: t=<ts>,te=<test_sig>,li=<live_sig>
 * signature = HMAC_SHA256(`${t}.${rawBody}`, webhookSecret)
 */
export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!config.paymongo.webhookSecret || !signatureHeader) return false;
  const parts = Object.fromEntries(String(signatureHeader).split(',').map((kv) => kv.split('=')));
  const t = parts.t;
  const sig = parts.li || parts.te;
  if (!t || !sig) return false;
  const expected = crypto.createHmac('sha256', config.paymongo.webhookSecret)
    .update(`${t}.${rawBody}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

/** Returns {eventId, eventType, referenceNumber, paid} or null if irrelevant. */
export function parseWebhook(rawBody) {
  let body;
  try { body = JSON.parse(rawBody); } catch { return null; }
  const data = body?.data;
  if (!data?.id) return null;
  const eventType = data.attributes?.type;
  const inner = data.attributes?.data;
  if (eventType !== 'checkout_session.payment.paid' && eventType !== 'payment.paid') {
    return { eventId: data.id, eventType, paid: false };
  }
  return {
    eventId: data.id,
    eventType,
    paid: true,
    referenceNumber: inner?.attributes?.reference_number
      || inner?.attributes?.payments?.[0]?.attributes?.reference_number
      || null,
    providerPaymentId: inner?.id || null,
  };
}
