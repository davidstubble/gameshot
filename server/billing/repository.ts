import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { billingAccounts, billingCatalog, billingEvents, billingLoginChallenges, billingPurchases, type PurchaseInsert } from '../../drizzle/schema';
import { getDb } from '../db';
import { isRevoked, type PaymentEnvironment, type PurchaseState } from '../../shared/billing';

export async function database() {
  const db = await getDb();
  if (!db) throw new Error('Purchase storage is unavailable. No access has been granted.');
  return db;
}
export async function accountToken(userId: number) {
  const db = await database();
  await db.insert(billingAccounts).values({ userId, appAccountToken: randomUUID() })
    .onDuplicateKeyUpdate({ set: { userId } });
  return (await db.select().from(billingAccounts).where(eq(billingAccounts.userId, userId)).limit(1))[0].appAccountToken;
}
export async function purchasesFor(userId: number, environment: PaymentEnvironment) {
  return (await database()).select().from(billingPurchases)
    .where(and(eq(billingPurchases.userId, userId), eq(billingPurchases.environment, environment)))
    .orderBy(desc(billingPurchases.createdAt)).limit(100);
}
export async function purchaseByKey(key: string) {
  return (await (await database()).select().from(billingPurchases).where(eq(billingPurchases.key, key)).limit(1))[0];
}
export async function savePurchase(input: PurchaseInsert) {
  const db = await database();
  return db.transaction(async (tx) => {
    await tx.insert(billingPurchases).values(input).onDuplicateKeyUpdate({ set: { key: input.key } });
    const existing = (await tx.select().from(billingPurchases).where(eq(billingPurchases.key, input.key)).limit(1).for('update'))[0];
    if (existing.userId !== input.userId || existing.provider !== input.provider || existing.environment !== input.environment) {
      throw new Error('This purchase belongs to a different account. Sign in with the original account.');
    }
    // Replayed older signed data must never resurrect refunded/revoked access.
    const status = isRevoked(existing.status) ? existing.status : input.status;
    await tx.update(billingPurchases).set({ ...input, status }).where(eq(billingPurchases.key, input.key));
    return { ...existing, ...input, status };
  });
}
export async function setPurchaseState(key: string, status: PurchaseState) {
  await (await database()).update(billingPurchases).set({ status }).where(eq(billingPurchases.key, key));
}
export async function eventProcessed(key: string) {
  return (await (await database()).select().from(billingEvents).where(eq(billingEvents.key, key)).limit(1)).length > 0;
}
export async function recordEvent(key: string) {
  await (await database()).insert(billingEvents).values({ key }).onDuplicateKeyUpdate({ set: { key } });
}
export async function getCatalog(key: string) {
  return (await (await database()).select().from(billingCatalog).where(eq(billingCatalog.key, key)).limit(1))[0];
}
export async function saveCatalog(value: typeof billingCatalog.$inferInsert) {
  await (await database()).insert(billingCatalog).values(value).onDuplicateKeyUpdate({ set: { key: value.key } });
  return getCatalog(value.key);
}
export const nonceHash = (nonce: string) => createHash('sha256').update(nonce).digest('hex');
export function verifierMatches(verifier: string, digest: string | null) {
  return /^[a-f0-9]{64}$/.test(verifier) && typeof digest === 'string' && /^[a-f0-9]{64}$/.test(digest) &&
    timingSafeEqual(Buffer.from(nonceHash(verifier), 'hex'), Buffer.from(digest, 'hex'));
}
export async function createLoginChallenge(nonce: string, redirectUri: string, kind: 'web' | 'native', verifierHash: string) {
  const db = await database();
  await db.delete(billingLoginChallenges).where(eq(billingLoginChallenges.nonceHash, nonceHash(nonce)));
  await db.insert(billingLoginChallenges).values({ nonceHash: nonceHash(nonce), redirectUri, kind, verifierHash, expiresAt: new Date(Date.now() + 600000) });
}
export async function consumeLoginChallenge(nonce: string, redirectUri: string, verifier: string, kind: 'web' | 'native') {
  const db = await database();
  return db.transaction(async (tx) => {
    const row = (await tx.select().from(billingLoginChallenges).where(and(
      eq(billingLoginChallenges.nonceHash, nonceHash(nonce)), eq(billingLoginChallenges.redirectUri, redirectUri),
      isNull(billingLoginChallenges.consumedAt), gt(billingLoginChallenges.expiresAt, new Date()),
    )).limit(1).for('update'))[0];
    if (!row) throw new Error('Login request expired or was already used. Start sign-in again.');
    if (row.kind !== kind || !verifierMatches(verifier, row.verifierHash)) throw new Error('Login verifier mismatch.');
    await tx.update(billingLoginChallenges).set({ consumedAt: new Date() }).where(eq(billingLoginChallenges.nonceHash, row.nonceHash));
    return row;
  });
}
