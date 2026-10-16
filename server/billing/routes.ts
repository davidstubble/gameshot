import express, { type Express, type Request, type Response } from 'express';
import { z } from 'zod';
import { PRO_OFFER, requiresPro } from '../../shared/billing';
import { sdk } from '../_core/sdk';
import { trustedExpoWebOrigins } from '../_core/cors';
import { trustedReturnOrigin } from './policy';
import { createCheckout, processStripeWebhook, reconcileCheckout } from './stripe';
import { processAppleNotification, verifyApplePurchase } from './apple';
import { billingStatus } from './service';
import { registerBillingLogin } from './login';

async function buyer(req: Request) {
  const user = await sdk.authenticateRequest(req);
  if (user.isCron || user.id <= 0) throw new Error('Interactive sign-in required.');
  return user;
}
function unavailable(res: Response) { res.status(503).json({ error: 'Payment service is temporarily unavailable. No new access has been granted. Please retry.' }); }
const rateWindows = new Map<string, { count: number; end: number }>();

/** Call before express.json(): Stripe signatures cover the exact bytes received. */
export function registerPaymentWebhooks(app: Express) {
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string' || !Buffer.isBuffer(req.body)) { res.status(400).json({ error: 'Invalid webhook signature.' }); return; }
    try { await processStripeWebhook(req.body, signature); res.json({ received: true }); }
    catch { res.status(400).json({ error: 'Webhook verification or fulfillment failed. Retry delivery.' }); }
  });
  app.post('/api/apple/notifications', express.json({ limit: '256kb' }), async (req, res) => {
    try { await processAppleNotification(req.body?.signedPayload); res.json({ received: true }); }
    catch { res.status(400).json({ error: 'App Store notification was not verified.' }); }
  });
}
export function registerBillingRoutes(app: Express) {
  app.use('/api/billing', (req, res, next) => {
    const now = Date.now();
    if (rateWindows.size > 1000) for (const [key, value] of rateWindows) if (value.end < now) rateWindows.delete(key);
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const value = rateWindows.get(key);
    if (!value || value.end < now) rateWindows.set(key, { count: 1, end: now + 60000 });
    else if (++value.count > 60) { res.status(429).json({ error: 'Too many requests. Please wait a minute.' }); return; }
    next();
  });
  registerBillingLogin(app);
  app.get('/api/billing/status', async (req, res) => {
    let user = null;
    try { user = await buyer(req); } catch { /* Real logged-out state, never a fabricated preview buyer. */ }
    try { res.setHeader('Cache-Control', 'private, no-store'); res.json(await billingStatus(user)); }
    catch { unavailable(res); }
  });
  app.post('/api/billing/authorize', async (req, res) => {
    const parsed = z.object({ imageCount: z.number().int().min(1).max(100000) }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid batch size.' }); return; }
    if (!requiresPro(parsed.data.imageCount)) { res.json({ authorized: true }); return; }
    let user;
    try { user = await buyer(req); } catch { res.status(401).json({ error: 'Sign in and upgrade to Pro for batches over 3 images.' }); return; }
    try {
      if (!(await billingStatus(user)).isPro) { res.status(403).json({ error: 'Free batches contain up to 3 images. Upgrade to Pro or remove extra images.' }); return; }
      res.json({ authorized: true });
    } catch { unavailable(res); }
  });
  app.post('/api/billing/checkout', async (req, res) => {
    let user;
    try { user = await buyer(req); } catch { res.status(401).json({ error: 'Sign in before purchasing Pro.' }); return; }
    let origin;
    try { origin = trustedReturnOrigin(req.body?.origin, trustedExpoWebOrigins()); }
    catch { res.status(400).json({ error: 'Invalid checkout return origin.' }); return; }
    try {
      if ((await billingStatus(user)).isPro) { res.status(409).json({ error: 'This account already owns Pro.' }); return; }
      res.json(await createCheckout(user, origin));
    } catch { unavailable(res); }
  });
  app.post('/api/billing/checkout/status', async (req, res) => {
    let user;
    try { user = await buyer(req); } catch { res.status(401).json({ error: 'Sign in to confirm this purchase.' }); return; }
    if (typeof req.body?.sessionId !== 'string') { res.status(400).json({ error: 'Missing checkout session.' }); return; }
    try {
      const { record } = await reconcileCheckout(req.body.sessionId, user.id);
      res.json({ status: record.status, isPro: record.status === 'active' });
    } catch { res.status(400).json({ error: 'This checkout could not be verified for your account.' }); }
  });
  app.post('/api/billing/apple/verify', async (req, res) => {
    let user;
    try { user = await buyer(req); } catch { res.status(401).json({ error: 'Sign in before verifying this App Store purchase.' }); return; }
    try { await verifyApplePurchase(user.id, req.body?.jws); res.json({ fulfilled: true, product: PRO_OFFER.key }); }
    catch { res.status(400).json({ error: 'App Store purchase could not be verified. Check account and owner setup; no new access has been granted.' }); }
  });
}
