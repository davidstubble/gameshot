import { describe, expect, it, vi } from 'vitest';
import type { User } from '../drizzle/schema';

vi.mock('../server/billing/repository', () => ({ accountToken: vi.fn(async () => 'token'), purchasesFor: vi.fn(async () => []) }));
vi.mock('../server/billing/stripe', () => ({ paymentEnvironment: () => 'test', reconcileCheckout: vi.fn() }));
vi.mock('../server/billing/apple', () => ({ appleReady: () => false, refreshApplePurchase: vi.fn() }));
vi.mock('../server/billing/readiness', () => ({ webCheckoutReady: async () => false, entitlementEnvironmentAllowed: () => true }));

const { billingStatus } = await import('../server/billing/service');
const account = (role: 'user' | 'admin'): User => ({ id: 7, openId: 'open-7', name: 'Owner', email: 'owner@example.com', loginMethod: 'email', role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });

describe('admin paywall bypass', () => {
  it('unlocks Pro for an admin account with no purchase records', async () => {
    const status = await billingStatus(account('admin'));
    expect(status).toMatchObject({ isAdmin: true, isPro: true, history: [] });
  });
  it('keeps a regular account without purchases on the free tier', async () => {
    const status = await billingStatus(account('user'));
    expect(status).toMatchObject({ isAdmin: false, isPro: false });
  });
  it('never grants admin to a signed-out visitor', async () => {
    const status = await billingStatus(null);
    expect(status).toMatchObject({ user: null, isAdmin: false, isPro: false });
  });
});
