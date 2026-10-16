import type Stripe from 'stripe';
import type { User } from '../../drizzle/schema';
import { PRO_OFFER } from '../../shared/billing';
import { ENV } from '../_core/env';
import { getCatalog, saveCatalog, savePurchase, eventProcessed, recordEvent, purchaseByKey, setPurchaseState } from './repository';
import { paidSessionState, validateStripeOffer } from './policy';
import { assertCheckoutReady } from './readiness';
import { paymentEnvironment, stripeClient } from './stripe-client';

export { paymentEnvironment, stripeReady, stripeClient } from './stripe-client';
const objectId = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id ?? null;
const purchaseKey = (id: string) => `stripe:${paymentEnvironment()}:${id}`;

export async function stripePrice() {
  const environment = paymentEnvironment();
  const key = `${environment}:${PRO_OFFER.key}`;
  const saved = await getCatalog(key);
  if (saved) return saved;
  const stripe = stripeClient();
  const product = await stripe.products.create({ name: PRO_OFFER.name, description: 'One-time lifetime Pro access. Larger screenshot batches; no subscription.', metadata: { app_id: ENV.appId, product_key: PRO_OFFER.key } }, { idempotencyKey: `${ENV.appId}:${key}:product` });
  const price = await stripe.prices.create({ product: product.id, currency: PRO_OFFER.currency, unit_amount: PRO_OFFER.amountCents }, { idempotencyKey: `${ENV.appId}:${key}:price` });
  return (await saveCatalog({ key, environment, stripeProductId: product.id, stripePriceId: price.id }))!;
}

export async function createCheckout(user: User, origin: string) {
  await assertCheckoutReady();
  const catalog = await stripePrice();
  const metadata = {
    user_id: String(user.id), app_id: ENV.appId, product_key: PRO_OFFER.key,
    ...(user.email ? { customer_email: user.email } : {}),
    ...(user.name ? { customer_name: user.name.slice(0, 500) } : {}),
  };
  const session = await stripeClient().checkout.sessions.create({
    mode: 'payment', line_items: [{ price: catalog.stripePriceId, quantity: 1 }],
    allowed_payment_method_types: ['card'],
    client_reference_id: String(user.id), customer_creation: 'always',
    ...(user.email ? { customer_email: user.email } : {}),
    metadata, payment_intent_data: { metadata }, allow_promotion_codes: true,
    success_url: `${origin}/pro?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pro?checkout=cancelled`,
  });
  if (!session.url) throw new Error('Checkout could not be opened.');
  await savePurchase({ key: purchaseKey(session.id), userId: user.id, provider: 'stripe', environment: paymentEnvironment(), productKey: PRO_OFFER.key, status: 'pending', providerTransactionId: session.id, checkoutSessionId: session.id });
  return { url: session.url, sessionId: session.id, environment: paymentEnvironment() };
}

/** Retrieval from Stripe is authoritative; a redirect or submitted event object is not. */
export async function reconcileCheckout(sessionId: string, expectedUserId?: number) {
  if (!/^cs_(test_|live_)?[A-Za-z0-9_]+$/.test(sessionId) || sessionId.length > 200) throw new Error('Invalid checkout session.');
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent.latest_charge'] });
  if (session.livemode !== (paymentEnvironment() === 'live')) throw new Error('Checkout environment mismatch.');
  const catalog = await stripePrice();
  const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2, expand: ['data.price'] });
  const price = lines.data[0]?.price;
  const userId = validateStripeOffer({
    mode: session.mode, userId: session.client_reference_id, metadataUserId: session.metadata?.user_id,
    productKey: session.metadata?.product_key, appId: session.metadata?.app_id, expectedAppId: ENV.appId,
    lineCount: lines.has_more ? 3 : lines.data.length, priceId: price?.id ?? null, expectedPriceId: catalog.stripePriceId,
    quantity: lines.data[0]?.quantity ?? null, amount: price?.unit_amount ?? null, currency: price?.currency ?? '',
  });
  if (expectedUserId !== undefined && userId !== expectedUserId) throw new Error('This checkout belongs to another account.');
  let status = paidSessionState(session.status, session.payment_status);
  const intent = session.payment_intent && typeof session.payment_intent !== 'string' ? session.payment_intent : null;
  const charge = intent?.latest_charge && typeof intent.latest_charge !== 'string' ? intent.latest_charge : null;
  const finalState = charge?.refunded ? 'refunded' : charge?.disputed ? 'revoked' :
    status === 'pending' && intent?.last_payment_error ? 'failed' : status;
  const record = await savePurchase({
    key: purchaseKey(session.id), userId, provider: 'stripe', environment: paymentEnvironment(), productKey: PRO_OFFER.key,
    status: finalState, providerTransactionId: objectId(session.payment_intent) ?? session.id,
    checkoutSessionId: session.id, paymentIntentId: objectId(session.payment_intent), customerId: objectId(session.customer),
    amount: session.amount_total === null ? null : (session.amount_total / 100).toFixed(3), currency: session.currency,
  });
  return { record, receiptUrl: charge?.receipt_url ?? null };
}

export async function reconcileStripePurchase(key: string, sessionId: string, userId: number) {
  // Sticky revocations are enforced in persistence, even if an older response is replayed.
  return reconcileCheckout(sessionId, userId);
}
export async function processStripeWebhook(raw: Buffer, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('Webhook verification is not configured.');
  const event = stripeClient().webhooks.constructEvent(raw, signature, secret);
  if (event.livemode !== (paymentEnvironment() === 'live')) throw new Error('Webhook environment mismatch.');
  const eventKey = `stripe:${paymentEnvironment()}:${event.id}`;
  if (await eventProcessed(eventKey)) return;
  if (event.type === 'checkout.session.completed') {
    await reconcileCheckout((event.data.object as Stripe.Checkout.Session).id);
  }
  // Other fixed subscribed event types do not independently grant this one-time offer.
  // Fulfillment is idempotent before recording the event, so a crash/redelivery cannot duplicate it.
  await recordEvent(eventKey);
}
export async function expireKnownCheckout(sessionId: string, userId: number) {
  const record = await purchaseByKey(purchaseKey(sessionId));
  if (!record || record.userId !== userId || record.status !== 'pending') return;
  await stripeClient().checkout.sessions.expire(sessionId);
  await setPurchaseState(record.key, 'expired');
}
