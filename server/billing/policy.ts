import { PRO_OFFER, type PaymentEnvironment } from '../../shared/billing';

export function trustedReturnOrigin(origin: unknown, trusted: ReadonlySet<string>): string {
  if (typeof origin !== 'string' || !trusted.has(origin)) throw new Error('Untrusted return origin.');
  const parsed = new URL(origin);
  if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid return origin.');
  return origin;
}
export function paidSessionState(status: string | null, paymentStatus: string): 'pending' | 'active' | 'expired' {
  if (status === 'expired') return 'expired';
  if (status === 'complete' && ['paid', 'no_payment_required'].includes(paymentStatus)) return 'active';
  return 'pending';
}
export function validateStripeOffer(input: {
  mode: string | null; userId: string | null; metadataUserId?: string;
  productKey?: string; appId?: string; expectedAppId: string;
  lineCount: number; priceId: string | null; expectedPriceId: string;
  quantity: number | null; amount: number | null; currency: string;
}) {
  if (input.mode !== 'payment' || !input.userId || input.metadataUserId !== input.userId ||
      input.productKey !== PRO_OFFER.key || input.appId !== input.expectedAppId ||
      input.lineCount !== 1 || input.priceId !== input.expectedPriceId || input.quantity !== 1 ||
      input.amount !== PRO_OFFER.amountCents || input.currency.toLowerCase() !== PRO_OFFER.currency ||
      !/^\d+$/.test(input.userId)) throw new Error('Checkout does not match the approved Pro offer.');
  return Number(input.userId);
}
export function validateAppleOffer(payload: {
  productId?: string; bundleId?: string; type?: string; appAccountToken?: string;
  transactionId?: string; originalTransactionId?: string; revocationDate?: number;
  environment?: string;
}, token: string, environment: PaymentEnvironment) {
  if (payload.productId !== PRO_OFFER.appleProductId || payload.bundleId !== PRO_OFFER.bundleId ||
      payload.type !== 'Non-Consumable' || payload.appAccountToken?.toLowerCase() !== token.toLowerCase() ||
      !payload.transactionId || !payload.originalTransactionId ||
      payload.environment !== (environment === 'test' ? 'Sandbox' : 'Production')) {
    throw new Error('App Store purchase does not match this app and account.');
  }
  return payload.revocationDate ? 'revoked' as const : 'active' as const;
}
