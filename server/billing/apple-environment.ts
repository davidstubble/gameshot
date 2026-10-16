import type { PaymentEnvironment } from '../../shared/billing';

/** Apple's StoreKit environment is independent of Stripe account activation. */
export function resolveApplePaymentEnvironment(runtime: string | undefined, configured?: string): PaymentEnvironment {
  if (configured === undefined || configured === '') return runtime === 'production' ? 'live' : 'test';
  if (configured === 'production') return 'live';
  if (configured === 'sandbox') return 'test';
  throw new Error('APPLE_IAP_ENVIRONMENT must be production or sandbox.');
}

export function applePaymentEnvironment(): PaymentEnvironment {
  return resolveApplePaymentEnvironment(process.env.NODE_ENV, process.env.APPLE_IAP_ENVIRONMENT);
}

export function appleRuntimeAllowsPurchases(environment: PaymentEnvironment, runtime = process.env.NODE_ENV): boolean {
  return runtime !== 'production' || environment === 'live';
}
