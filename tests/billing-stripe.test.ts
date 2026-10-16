import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import type { User } from '../drizzle/schema';

const fixture = vi.hoisted(() => ({ session: {} as Record<string, unknown>, priceId: 'price_pro', lineAmount: 999,
  records: new Map<string, Record<string, unknown>>(), events: new Set<string>(), checkoutParams: null as Record<string, unknown> | null,
}));
vi.mock('../server/_core/env', () => ({ ENV: { appId: 'test-app', cookieSecret: 'unit-test-secret', oAuthServerUrl: '', ownerOpenId: '' } }));
vi.mock('../server/billing/repository', () => ({
  getCatalog: async () => ({ stripeProductId: 'prod_pro', stripePriceId: 'price_pro' }),
  saveCatalog: async (input: unknown) => input,
  savePurchase: async (input: Record<string, unknown>) => {
    const key = String(input.key); const old = fixture.records.get(key);
    if (old && old.userId !== input.userId) throw new Error('Wrong buyer.');
    const record = { createdAt: new Date(), ...old, ...input, status: old && ['refunded', 'revoked'].includes(String(old.status)) ? old.status : input.status };
    fixture.records.set(key, record); return record;
  },
  eventProcessed: async (key: string) => fixture.events.has(key),
  recordEvent: async (key: string) => { fixture.events.add(key); },
  purchaseByKey: async (key: string) => fixture.records.get(key),
  setPurchaseState: async (key: string, status: string) => { const row = fixture.records.get(key); if (row) row.status = status; },
}));
vi.mock('stripe', async () => {
  const actual = await vi.importActual<typeof import('stripe')>('stripe');
  const real = new actual.default('sk_test_unit_fixture');
  return { default: vi.fn(() => ({
    webhooks: real.webhooks,
    products: { create: async () => ({ id: 'prod_pro' }) }, prices: { create: async () => ({ id: 'price_pro' }) },
    checkout: { sessions: {
      create: async (params: Record<string, unknown>) => { fixture.checkoutParams = params; return { ...fixture.session, url: 'https://checkout.stripe.com/c/pay/unit_fixture' }; },
      retrieve: async () => fixture.session,
      listLineItems: async () => ({ has_more: false, data: [{ quantity: 1, price: { id: fixture.priceId, unit_amount: fixture.lineAmount, currency: 'usd' } }] }),
      expire: async () => undefined,
    } },
  })) };
});
import { createCheckout, processStripeWebhook, reconcileCheckout, stripeClient } from '../server/billing/stripe';
import { registerPaymentWebhooks } from '../server/billing/routes';
import { PRO_OFFER } from '../shared/billing';

beforeEach(() => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_unit_fixture'); vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_unit_fixture');
  fixture.records.clear(); fixture.events.clear(); fixture.priceId = 'price_pro'; fixture.lineAmount = 999; fixture.checkoutParams = null;
  fixture.session = { id: 'cs_test_fixture', mode: 'payment', livemode: false, status: 'open', payment_status: 'unpaid',
    client_reference_id: '17', metadata: { user_id: '17', app_id: 'test-app', product_key: PRO_OFFER.key },
    amount_total: 999, currency: 'usd', customer: 'cus_fixture',
    payment_intent: { id: 'pi_fixture', latest_charge: { id: 'ch_fixture', refunded: false, disputed: false, receipt_url: 'https://pay.stripe.com/receipts/unit_fixture' } },
  };
});
const user: User = { id: 17, openId: 'unit-buyer', name: 'Unit Buyer', email: 'buyer@example.test', role: 'user', loginMethod: 'test', createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

describe('one-time web Checkout', () => {
  it('uses the central price, buyer metadata, promotion codes and public return origin', async () => {
    await createCheckout(user, 'https://preview.example');
    expect(fixture.checkoutParams).toMatchObject({ mode: 'payment', allow_promotion_codes: true,
      allowed_payment_method_types: ['card'],
      line_items: [{ price: 'price_pro', quantity: 1 }], customer_email: user.email, client_reference_id: '17',
      metadata: { user_id: '17', customer_email: user.email, customer_name: user.name },
      success_url: 'https://preview.example/pro?checkout=success&session_id={CHECKOUT_SESSION_ID}', cancel_url: 'https://preview.example/pro?checkout=cancelled' });
    expect([...fixture.records.values()][0].status).toBe('pending');
  });
  it('does not grant from an unpaid or merely completed redirect', async () => {
    fixture.session.status = 'complete';
    expect((await reconcileCheckout('cs_test_fixture', 17)).record.status).toBe('pending');
  });
  it('fulfills only provider-retrieved paid Checkout and returns its receipt', async () => {
    fixture.session.status = 'complete'; fixture.session.payment_status = 'paid';
    const result = await reconcileCheckout('cs_test_fixture', 17);
    expect(result.record.status).toBe('active'); expect(result.record.amount).toBe('9.990');
    expect(result.receiptUrl).toContain('pay.stripe.com/receipts');
  });
  it('allows a provider-authorized 100%-discount promotion without changing the approved catalog price', async () => {
    fixture.session.status = 'complete'; fixture.session.payment_status = 'no_payment_required'; fixture.session.amount_total = 0;
    expect((await reconcileCheckout('cs_test_fixture', 17)).record.status).toBe('active');
  });
  it('rejects the wrong offer or buyer even when payment_status says paid', async () => {
    fixture.session.status = 'complete'; fixture.session.payment_status = 'paid';
    fixture.priceId = 'price_other'; await expect(reconcileCheckout('cs_test_fixture', 17)).rejects.toThrow();
    fixture.priceId = 'price_pro'; await expect(reconcileCheckout('cs_test_fixture', 18)).rejects.toThrow();
    expect(fixture.records.size).toBe(0);
  });
  it('revokes refunded payments and does not resurrect them from stale responses', async () => {
    fixture.session.status = 'complete'; fixture.session.payment_status = 'paid';
    const intent = fixture.session.payment_intent as { latest_charge: { refunded: boolean } };
    intent.latest_charge.refunded = true;
    expect((await reconcileCheckout('cs_test_fixture', 17)).record.status).toBe('refunded');
    intent.latest_charge.refunded = false;
    expect((await reconcileCheckout('cs_test_fixture', 17)).record.status).toBe('refunded');
  });
});
describe('exact-byte webhook signatures and repeat delivery', () => {
  const event = () => JSON.stringify({ id: 'evt_unit_fixture', object: 'event', livemode: false, type: 'checkout.session.completed', data: { object: { id: 'cs_test_fixture' } } });
  it('verifies the real signature format, retrieves the provider session, and deduplicates fulfillment', async () => {
    fixture.session.status = 'complete'; fixture.session.payment_status = 'paid';
    const raw = event(); const signature = stripeClient().webhooks.generateTestHeaderString({ payload: raw, secret: 'whsec_unit_fixture' });
    await processStripeWebhook(Buffer.from(raw), signature); await processStripeWebhook(Buffer.from(raw), signature);
    expect(fixture.events.size).toBe(1); expect(fixture.records.size).toBe(1); expect([...fixture.records.values()][0].status).toBe('active');
  });
  it('rejects re-serialized bytes or an incorrect signature without writing fulfillment', async () => {
    const raw = event(); const signature = stripeClient().webhooks.generateTestHeaderString({ payload: raw, secret: 'whsec_unit_fixture' });
    await expect(processStripeWebhook(Buffer.from(` ${raw}`), signature)).rejects.toThrow();
    await expect(processStripeWebhook(Buffer.from(raw), 'invalid')).rejects.toThrow();
    expect(fixture.records.size).toBe(0); expect(fixture.events.size).toBe(0);
  });
  it('registers the raw route before JSON parsing and acknowledges a fixed subscribed event that grants nothing', async () => {
    const app = express(); registerPaymentWebhooks(app); app.use(express.json());
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('Test server address unavailable.');
    try {
      const raw = '{ "id": "evt_no_grant", "object": "event", "livemode": false, "type": "payment_intent.succeeded", "data": {"object": {"id": "pi_unit"}} }';
      const signature = stripeClient().webhooks.generateTestHeaderString({ payload: raw, secret: 'whsec_unit_fixture' });
      const response = await fetch(`http://127.0.0.1:${address.port}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature }, body: raw });
      expect(response.status).toBe(200); expect(await response.json()).toEqual({ received: true });
      expect(fixture.events.size).toBe(1); expect(fixture.records.size).toBe(0);
    } finally {
      server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
