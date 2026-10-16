import Stripe from 'stripe';
import type { PaymentEnvironment } from '../../shared/billing';

export function paymentEnvironment(): PaymentEnvironment {
  return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? '') ? 'live' : 'test';
}
export const stripeReady = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
export function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Web checkout has not been configured.');
  return new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 1 });
}
