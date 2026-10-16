import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveApplePaymentEnvironment, applePaymentEnvironment, appleRuntimeAllowsPurchases } from '../server/billing/apple-environment';

afterEach(() => vi.unstubAllEnvs());
describe('Apple environment is independent of Stripe', () => {
  it('defaults production to Apple Production even with absent or test Stripe keys', () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('APPLE_IAP_ENVIRONMENT', '');
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    expect(applePaymentEnvironment()).toBe('live');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture_not_a_real_credential');
    expect(applePaymentEnvironment()).toBe('live');
  });
  it('defaults development to Sandbox even if web Stripe is live', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('APPLE_IAP_ENVIRONMENT', '');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_fixture_not_a_real_credential');
    expect(applePaymentEnvironment()).toBe('test');
  });
  it('supports an explicit Apple environment and rejects misspelled modes', () => {
    expect(resolveApplePaymentEnvironment('development', 'production')).toBe('live');
    expect(resolveApplePaymentEnvironment('production', 'sandbox')).toBe('test');
    expect(() => resolveApplePaymentEnvironment('production', 'prod')).toThrow();
  });
  it('never opens sandbox purchasing in a production backend', () => {
    expect(appleRuntimeAllowsPurchases('test', 'production')).toBe(false);
    expect(appleRuntimeAllowsPurchases('live', 'production')).toBe(true);
    expect(appleRuntimeAllowsPurchases('test', 'development')).toBe(true);
  });
});
