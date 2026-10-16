import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ row: null as Record<string, unknown> | null, input: {} as Record<string, unknown>, consumed: false, locks: [] as string[] }));
vi.mock('../server/db', () => {
  class FakeDatabase {
    transaction<T>(action: (tx: FakeDatabase) => Promise<T>) { return action(this); }
    insert() { return { values(input: Record<string, unknown>) { fixture.input = input; return { onDuplicateKeyUpdate: async () => { if (!fixture.row) fixture.row = { ...input }; } }; } }; }
    select() { return { from() { return { where() { return { limit() { return { for: async (lock: string) => { fixture.locks.push(lock); return fixture.row ? [{ ...fixture.row }] : []; } }; } }; } }; } }; }
    update() { return { set(input: Record<string, unknown>) { return { where: async () => { fixture.row = { ...fixture.row, ...input }; if (input.consumedAt) fixture.consumed = true; } }; } }; }
  }
  const db = new FakeDatabase(); return { getDb: async () => db };
});
import { consumeLoginChallenge, nonceHash, savePurchase } from '../server/billing/repository';
import { PRO_OFFER } from '../shared/billing';
const purchase = { key: 'stripe:test:cs_unit', userId: 17, provider: 'stripe' as const, environment: 'test' as const,
  productKey: PRO_OFFER.key, status: 'active' as const, providerTransactionId: 'pi_unit' };
beforeEach(() => { fixture.row = null; fixture.input = {}; fixture.consumed = false; fixture.locks = []; });

describe('durable purchase ownership and revocation rules', () => {
  it('creates and idempotently updates the same purchase under a row lock', async () => {
    expect((await savePurchase(purchase)).status).toBe('active');
    expect((await savePurchase(purchase)).status).toBe('active');
    expect(fixture.row?.key).toBe(purchase.key); expect(fixture.locks).toEqual(['update', 'update']);
  });
  it('does not transfer another account’s purchase', async () => {
    fixture.row = { ...purchase, userId: 18 };
    await expect(savePurchase(purchase)).rejects.toThrow('different account');
    expect(fixture.row.userId).toBe(18);
  });
  it('does not revive a refunded or revoked purchase from older active data', async () => {
    for (const status of ['refunded', 'revoked']) {
      fixture.row = { ...purchase, status };
      expect((await savePurchase(purchase)).status).toBe(status); expect(fixture.row.status).toBe(status);
    }
  });
});
describe('proof before login-challenge consumption', () => {
  const nonce = '2'.repeat(64); const privateVerifier = '1'.repeat(64); const redirectUri = 'manus070466106350822:///oauth/callback';
  it('does not consume an intercepted public nonce supplied as the private verifier', async () => {
    fixture.row = { nonceHash: nonceHash(nonce), redirectUri, kind: 'native', verifierHash: nonceHash(privateVerifier) };
    await expect(consumeLoginChallenge(nonce, redirectUri, nonce, 'native')).rejects.toThrow('verifier mismatch');
    expect(fixture.consumed).toBe(false);
  });
  it('requires the correct private verifier and channel before consuming', async () => {
    fixture.row = { nonceHash: nonceHash(nonce), redirectUri, kind: 'native', verifierHash: nonceHash(privateVerifier) };
    await expect(consumeLoginChallenge(nonce, redirectUri, privateVerifier, 'web')).rejects.toThrow('verifier mismatch');
    expect(fixture.consumed).toBe(false);
    await consumeLoginChallenge(nonce, redirectUri, privateVerifier, 'native'); expect(fixture.consumed).toBe(true);
  });
});
