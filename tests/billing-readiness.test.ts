import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ ready: true, account: { charges_enabled: true, payouts_enabled: true, details_submitted: true }, calls: 0, failed: false }));
vi.mock('../shared/public-site', () => ({ PUBLIC_SITE: { publisher: 'GameShot Apps', origin: null, supportEmail: null } }));
vi.mock('../server/billing/stripe-client', () => ({
  paymentEnvironment: () => process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test',
  stripeReady: () => fixture.ready,
  stripeClient: () => ({ accounts: { retrieve: async (id: unknown) => {
    expect(id).toBeNull(); fixture.calls++; if (fixture.failed) throw new Error('fixture failure'); return fixture.account;
  } } }),
}));
import { assertCheckoutReady, entitlementEnvironmentAllowed, productionCheckoutAllowed, webCheckoutReady } from '../server/billing/readiness';
let keyCounter = 0;
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('PUBLIC_APP_ORIGIN', 'https://app.example.test');
  vi.stubEnv('STRIPE_SECRET_KEY', `sk_live_fixture_${++keyCounter}`);
  fixture.ready = true; fixture.calls = 0; fixture.failed = false;
  fixture.account = { charges_enabled: true, payouts_enabled: true, details_submitted: true };
});
afterEach(() => vi.unstubAllEnvs());
describe('full-release payment readiness', () => {
  it('permits development test mode but never production test Checkout or entitlements', async () => {
    expect(productionCheckoutAllowed('test', 'development', null)).toBe(true);
    expect(productionCheckoutAllowed('test', 'production', 'https://app.example.test')).toBe(false);
    expect(entitlementEnvironmentAllowed('test', 'production')).toBe(false);
    expect(entitlementEnvironmentAllowed('live', 'production')).toBe(true);
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture');
    expect(await webCheckoutReady()).toBe(false);
    await expect(assertCheckoutReady()).rejects.toThrow('temporarily unavailable');
    expect(fixture.calls).toBe(0);
  });
  it('requires an explicit secure production origin and configured payment secrets', async () => {
    vi.stubEnv('PUBLIC_APP_ORIGIN', ''); expect(await webCheckoutReady()).toBe(false);
    vi.stubEnv('PUBLIC_APP_ORIGIN', 'http://app.example.test'); expect(await webCheckoutReady()).toBe(false);
    vi.stubEnv('PUBLIC_APP_ORIGIN', 'https://app.example.test'); fixture.ready = false;
    expect(await webCheckoutReady()).toBe(false);
  });
  it('opens live Checkout only for an activated merchant with charges and payouts enabled', async () => {
    expect(await webCheckoutReady()).toBe(true); expect(fixture.calls).toBe(1);
    expect(await webCheckoutReady()).toBe(true); expect(fixture.calls).toBe(1);
  });
  it('keeps Checkout closed when payouts or merchant activation are incomplete', async () => {
    fixture.account.payouts_enabled = false; expect(await webCheckoutReady()).toBe(false);
  });
  it('fails closed when the live account check cannot be completed', async () => {
    fixture.failed = true; expect(await webCheckoutReady()).toBe(false);
  });
  it('retains usable configured test Checkout during development', async () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture');
    expect(await webCheckoutReady()).toBe(true); expect(fixture.calls).toBe(0);
  });
});
