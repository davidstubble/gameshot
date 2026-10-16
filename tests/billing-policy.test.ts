import { describe, expect, it } from 'vitest';
import { PRO_OFFER, requiresPro } from '../shared/billing';
import { paidSessionState, trustedReturnOrigin, validateAppleOffer, validateStripeOffer } from '../server/billing/policy';

const stripeOffer = {
  mode: 'payment', userId: '17', metadataUserId: '17', productKey: PRO_OFFER.key,
  appId: 'app', expectedAppId: 'app', lineCount: 1, priceId: 'price_pro', expectedPriceId: 'price_pro',
  quantity: 1, amount: 999, currency: 'usd',
};
const appleOffer = { productId: PRO_OFFER.appleProductId, bundleId: PRO_OFFER.bundleId, type: 'Non-Consumable',
  appAccountToken: 'a0b15ccc-a081-4a6b-8c55-e92b93d2e51a', transactionId: '1001', originalTransactionId: '1001', environment: 'Sandbox' };

describe('approved free and Pro offer', () => {
  it('is $9.99 USD once and three images per free batch', () => {
    expect(PRO_OFFER.amountCents).toBe(999); expect(PRO_OFFER.currency).toBe('usd');
    expect(PRO_OFFER.freeBatchLimit).toBe(3);
    expect([0, 1, 2, 3].map(requiresPro)).toEqual([false, false, false, false]);
    expect(requiresPro(4)).toBe(true); expect(requiresPro(100)).toBe(true);
  });
  it('rejects fractional, negative, infinite and unsafe counts', () => {
    for (const count of [-1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => requiresPro(count)).toThrow();
  });
});
describe('server-authoritative web payments', () => {
  it('requires a completed paid or zero-cost-promoted session', () => {
    expect(paidSessionState('open', 'unpaid')).toBe('pending');
    expect(paidSessionState('complete', 'unpaid')).toBe('pending');
    expect(paidSessionState('complete', 'paid')).toBe('active');
    expect(paidSessionState('complete', 'no_payment_required')).toBe('active');
    expect(paidSessionState('expired', 'unpaid')).toBe('expired');
  });
  it('validates the exact stored price, buyer, app, quantity and product', () => {
    expect(validateStripeOffer(stripeOffer)).toBe(17);
    for (const patch of [{ amount: 998 }, { amount: 1999 }, { mode: 'subscription' }, { metadataUserId: '18' },
      { userId: 'not-a-user' }, { appId: 'other-app' }, { lineCount: 2 }, { quantity: 2 },
      { priceId: 'price_other' }, { currency: 'eur' }, { productKey: 'other' }]) {
      expect(() => validateStripeOffer({ ...stripeOffer, ...patch })).toThrow();
    }
  });
  it('rejects untrusted or path-bearing return destinations', () => {
    const allowed = new Set(['https://preview.example']);
    expect(trustedReturnOrigin('https://preview.example', allowed)).toBe('https://preview.example');
    for (const origin of ['https://evil.example', 'https://preview.example/redirect', 'javascript:alert(1)', '//evil.example', null]) expect(() => trustedReturnOrigin(origin, allowed)).toThrow();
  });
});
describe('Apple receipt-to-account binding', () => {
  it('accepts only the app’s non-consumable product for the bound account and environment', () => {
    expect(validateAppleOffer(appleOffer, appleOffer.appAccountToken, 'test')).toBe('active');
    for (const patch of [{ productId: 'other' }, { bundleId: 'other' }, { type: 'Consumable' }, { appAccountToken: 'other' },
      { environment: 'Production' }, { transactionId: undefined }, { originalTransactionId: undefined }]) {
      expect(() => validateAppleOffer({ ...appleOffer, ...patch }, appleOffer.appAccountToken, 'test')).toThrow();
    }
  });
  it('does not grant a revoked purchase or mix sandbox and live purchases', () => {
    expect(validateAppleOffer({ ...appleOffer, revocationDate: 1000 }, appleOffer.appAccountToken, 'test')).toBe('revoked');
    expect(() => validateAppleOffer(appleOffer, appleOffer.appAccountToken, 'live')).toThrow();
    expect(validateAppleOffer({ ...appleOffer, environment: 'Production' }, appleOffer.appAccountToken, 'live')).toBe('active');
  });
});
