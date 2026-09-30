import { sweepExpiredSubscriptions } from './networkService.js';

/**
 * PHASE 5/9: automatic expiration. Every 30s, ACTIVE subscriptions whose
 * expires_at passed are marked EXPIRED and their sessions deauthorized,
 * which puts the customer's devices back behind the captive portal.
 */
export function startJobs() {
  const tick = async () => {
    try {
      const expired = await sweepExpiredSubscriptions();
      if (expired.length) {
        console.log(`[jobs] expired ${expired.length} subscription(s): ${expired.map((s) => s.id).join(', ')}`);
      }
    } catch (e) {
      console.error('[jobs] sweep failed:', e);
    }
  };
  const timer = setInterval(tick, 30_000);
  timer.unref?.();
  return timer;
}
