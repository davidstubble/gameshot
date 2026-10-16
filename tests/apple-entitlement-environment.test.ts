import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User, billingPurchases } from '../drizzle/schema';
import { PRO_OFFER } from '../shared/billing';

type PurchaseRow = typeof billingPurchases.$inferSelect;
const fixture = vi.hoisted(() => ({ rows: [] as PurchaseRow[], refresh: vi.fn(async () => 'active') }));
vi.mock('../server/billing/repository', () => ({ accountToken: vi.fn(async () => 'fixture-token'),
  purchasesFor: vi.fn(async (_user: number, environment: string) => fixture.rows.filter((r) => r.environment === environment)),
}));
vi.mock('../server/billing/stripe', () => ({ paymentEnvironment: () => 'test', reconcileCheckout: vi.fn() }));
vi.mock('../server/billing/apple', () => ({ appleReady: () => true, refreshApplePurchase: fixture.refresh }));
vi.mock('../server/billing/readiness', () => ({ webCheckoutReady: async () => false,
  entitlementEnvironmentAllowed: (mode: string) => process.env.NODE_ENV !== 'production' || mode === 'live',
}));
import { billingStatus } from '../server/billing/service';

const user = { id: 7, name: 'Fixture buyer', email: 'fixture@example.com', role: 'user' } as User;
function row(provider: 'apple' | 'stripe', environment: 'test' | 'live', status: 'active' | 'refunded' = 'active'): PurchaseRow {
  return { key: `${provider}:${environment}:fixture`, userId: 7, provider, environment, productKey: PRO_OFFER.key, status,
    providerTransactionId: 'transaction-fixture', originalTransactionId: provider === 'apple' ? 'original-fixture' : null,
    checkoutSessionId: null, paymentIntentId: null, customerId: null, amount: '9.990', currency: 'USD',
    createdAt: new Date('2026-10-01'), updatedAt: new Date('2026-10-01') };
}
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('APPLE_IAP_ENVIRONMENT', '');
  fixture.rows = []; fixture.refresh.mockClear(); fixture.refresh.mockResolvedValue('active');
});
afterEach(() => vi.unstubAllEnvs());
describe('provider-specific access', () => {
  it('finds current live Apple access even while Stripe is test-only', async () => {
    fixture.rows = [row('apple', 'live'), row('apple', 'test'), row('stripe', 'test')];
    const status = await billingStatus(user);
    expect(status.environment).toBe('test'); expect(status.appleEnvironment).toBe('live');
    expect(status.isPro).toBe(true); expect(status.webReady).toBe(false);
    expect(status.history.filter((r) => r.provider === 'apple').map((r) => r.environment)).toEqual(['live']);
    expect(fixture.refresh).toHaveBeenCalledOnce();
    expect(fixture.refresh).toHaveBeenCalledWith(7, 'original-fixture', 'transaction-fixture', 'live');
  });
  it('does not turn an old sandbox license or test web purchase into production Pro', async () => {
    fixture.rows = [row('apple', 'test'), row('stripe', 'test')];
    expect((await billingStatus(user)).isPro).toBe(false);
    expect(fixture.refresh).not.toHaveBeenCalled();
  });
  it('respects current provider revocation', async () => {
    fixture.rows = [row('apple', 'live')]; fixture.refresh.mockResolvedValue('revoked');
    expect((await billingStatus(user)).isPro).toBe(false);
  });
  it('does not restore refunded access', async () => {
    fixture.rows = [row('apple', 'live', 'refunded')];
    expect((await billingStatus(user)).isPro).toBe(false);
    expect(fixture.refresh).not.toHaveBeenCalled();
  });
  it('keeps the anonymous free limit and explicit admin access unchanged', async () => {
    expect(await billingStatus(null)).toMatchObject({ isPro: false, isAdmin: false, freeBatchLimit: 3 });
    expect((await billingStatus({ ...user, role: 'admin' })).isPro).toBe(true);
  });
});
