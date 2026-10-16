import { createHash } from 'node:crypto';
import type { PaymentEnvironment } from '../../shared/billing';
import { configuredPublicOrigin } from '../web/routes';
import { paymentEnvironment, stripeClient, stripeReady } from './stripe-client';

export const PURCHASE_UNAVAILABLE = 'Pro purchasing is temporarily unavailable while live payment setup is completed. Free batches up to 3 images still work.';

export function productionCheckoutAllowed(environment: PaymentEnvironment, runtime: string | undefined, origin: string | null): boolean {
  return runtime !== 'production' || (environment === 'live' && Boolean(origin?.startsWith('https://')));
}

export function entitlementEnvironmentAllowed(environment: PaymentEnvironment, runtime = process.env.NODE_ENV): boolean {
  return runtime !== 'production' || environment === 'live';
}

type MerchantCheck = { keyHash: string; until: number; ready: boolean };
let merchantCheck: MerchantCheck | null = null;
let merchantPromise: Promise<boolean> | null = null;
let merchantPromiseKey: string | null = null;

async function merchantReady(): Promise<boolean> {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  const keyHash = createHash('sha256').update(key).digest('hex');
  if (merchantCheck?.keyHash === keyHash && merchantCheck.until > Date.now()) return merchantCheck.ready;
  if (merchantPromise && merchantPromiseKey === keyHash) return merchantPromise;
  merchantPromiseKey = keyHash;
  const request = (async () => {
    let ready = false;
    try {
      const account = await stripeClient().accounts.retrieve(null);
      ready = account.charges_enabled === true && account.payouts_enabled === true && account.details_submitted === true;
    } catch { /* Missing permission, invalid keys or incomplete activation must not open live Checkout. */ }
    merchantCheck = { keyHash, until: Date.now() + 30000, ready };
    return ready;
  })();
  merchantPromise = request;
  try { return await request; }
  finally { if (merchantPromise === request) { merchantPromise = null; merchantPromiseKey = null; } }
}

export async function webCheckoutReady(): Promise<boolean> {
  if (!stripeReady()) return false;
  const environment = paymentEnvironment();
  if (!productionCheckoutAllowed(environment, process.env.NODE_ENV, configuredPublicOrigin())) return false;
  // Development test Checkout remains usable. Live Checkout requires a verified activated merchant.
  return environment === 'test' ? true : merchantReady();
}

export async function assertCheckoutReady(): Promise<void> {
  if (!(await webCheckoutReady())) throw new Error(PURCHASE_UNAVAILABLE);
}
