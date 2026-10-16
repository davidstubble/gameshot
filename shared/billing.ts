export const PRO_OFFER = {
  key: 'gameshot-pro-lifetime-v1',
  name: 'GameShot Pro',
  amountCents: 999,
  currency: 'usd',
  displayPrice: '$9.99',
  freeBatchLimit: 3,
  bundleId: 'space.manus.gameshot.t070466106350822',
  appleProductId: 'space.manus.gameshot.t070466106350822.pro.lifetime',
} as const;

export type PaymentEnvironment = 'test' | 'live';
export type PurchaseState = 'pending' | 'active' | 'refunded' | 'revoked' | 'expired' | 'failed';
export type PurchaseHistory = {
  id: string; provider: 'stripe' | 'apple'; environment: PaymentEnvironment;
  status: PurchaseState; product: string; amount: string | null;
  currency: string | null; createdAt: string; receiptUrl?: string | null;
};
export type BillingStatus = {
  user: { id: number; name: string | null; email: string | null } | null;
  /** isAdmin comes only from the server-side user role; admins get Pro without a purchase record. */
  isPro: boolean; isAdmin: boolean; environment: PaymentEnvironment; freeBatchLimit: number;
  /** Native StoreKit mode is independent of web Stripe mode; optional for older servers. */
  appleEnvironment?: PaymentEnvironment;
  webReady: boolean; appleReady: boolean; appAccountToken: string | null;
  history: PurchaseHistory[];
};

export function requiresPro(imageCount: number): boolean {
  if (!Number.isSafeInteger(imageCount) || imageCount < 0) throw new Error('Invalid image count.');
  return imageCount > PRO_OFFER.freeBatchLimit;
}
export function isRevoked(state: PurchaseState): boolean {
  return state === 'refunded' || state === 'revoked';
}
