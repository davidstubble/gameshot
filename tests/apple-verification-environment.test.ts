import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRO_OFFER } from '../shared/billing';

const fixture = vi.hoisted(() => ({
  verifierModes: [] as string[], clientModes: [] as string[],
  payload: {} as Record<string, unknown>, flipMode: false,
  save: vi.fn(async (value: Record<string, unknown>) => value),
  event: vi.fn(async () => {}),
}));
vi.mock('@apple/app-store-server-library', () => ({
  Environment: { SANDBOX: 'Sandbox', PRODUCTION: 'Production' },
  SignedDataVerifier: class {
    constructor(_roots: unknown, _online: boolean, mode: string) { fixture.verifierModes.push(mode); }
    async verifyAndDecodeTransaction() {
      if (fixture.flipMode) process.env.APPLE_IAP_ENVIRONMENT = 'sandbox';
      return fixture.payload;
    }
    async verifyAndDecodeNotification() { return { notificationUUID: 'notification-fixture', notificationType: 'TEST' }; }
  },
  AppStoreServerAPIClient: class {
    constructor(_key: unknown, _id: unknown, _issuer: unknown, _bundle: unknown, mode: string) { fixture.clientModes.push(mode); }
    async getTransactionInfo() { return { signedTransactionInfo: 'current.fixture.signature' }; }
  },
}));
vi.mock('../server/billing/repository', () => ({
  accountToken: vi.fn(async () => 'fixture-account-token'),
  savePurchase: fixture.save, eventProcessed: vi.fn(async () => false), recordEvent: fixture.event,
  purchaseByKey: vi.fn(), setPurchaseState: vi.fn(),
}));
import { appleReady, verifyApplePurchase, processAppleNotification } from '../server/billing/apple';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('APPLE_IAP_ENVIRONMENT', '');
  vi.stubEnv('STRIPE_SECRET_KEY', '');
  vi.stubEnv('APPLE_IAP_PRIVATE_KEY', 'isolated-test-fixture');
  vi.stubEnv('APPLE_IAP_KEY_ID', 'fixture-key-id'); vi.stubEnv('APPLE_IAP_ISSUER_ID', 'fixture-issuer');
  vi.stubEnv('APPLE_APP_ID', '123456789');
  fixture.verifierModes.length = 0; fixture.clientModes.length = 0; fixture.flipMode = false;
  fixture.save.mockClear(); fixture.event.mockClear();
  fixture.payload = { productId: PRO_OFFER.appleProductId, bundleId: PRO_OFFER.bundleId,
    type: 'Non-Consumable', appAccountToken: 'fixture-account-token', transactionId: 'transaction-fixture',
    originalTransactionId: 'original-fixture', environment: 'Production', price: 9990, currency: 'USD' };
});
afterEach(() => vi.unstubAllEnvs());
describe('Apple-only production verification', () => {
  it('uses Production verification and current lookup with no Stripe key', async () => {
    expect(appleReady()).toBe(true);
    await verifyApplePurchase(7, 'submitted.fixture.signature');
    expect(fixture.verifierModes).toEqual(['Production']);
    expect(fixture.clientModes).toEqual(['Production']);
    expect(fixture.save).toHaveBeenCalledWith(expect.objectContaining({ key: 'apple:live:original-fixture', environment: 'live', status: 'active' }));
  });
  it('freezes mode before asynchronous verification', async () => {
    fixture.flipMode = true;
    await verifyApplePurchase(7, 'submitted.fixture.signature');
    expect(fixture.clientModes).toEqual(['Production']);
    expect(fixture.save).toHaveBeenCalledWith(expect.objectContaining({ environment: 'live' }));
  });
  it('requires the numeric Apple app ID in Production', () => {
    vi.stubEnv('APPLE_APP_ID', '');
    expect(appleReady()).toBe(false);
  });
  it('rejects a sandbox transaction in Production without writing entitlement', async () => {
    fixture.payload.environment = 'Sandbox';
    await expect(verifyApplePurchase(7, 'submitted.fixture.signature')).rejects.toThrow();
    expect(fixture.save).not.toHaveBeenCalled();
  });
  it('keeps sandbox setup closed in a production backend', () => {
    vi.stubEnv('APPLE_IAP_ENVIRONMENT', 'sandbox');
    expect(appleReady()).toBe(false);
  });
  it('uses Apple mode in notification idempotency keys', async () => {
    await processAppleNotification('notification.fixture.signature');
    expect(fixture.event).toHaveBeenCalledWith('apple:live:notification-fixture');
  });
});
