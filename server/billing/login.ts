import { randomBytes } from 'node:crypto';
import { parse } from 'cookie';
import type { Express, Request, Response } from 'express';
import { PRO_OFFER } from '../../shared/billing';
import { ONE_YEAR_MS } from '../../shared/const';
import { ENV } from '../_core/env';
import { sdk } from '../_core/sdk';
import { trustedExpoWebOrigins } from '../_core/cors';
import { getSessionCookieName, getSessionCookieOptions } from '../_core/cookies';
import { upsertUser, getUserByOpenId } from '../db';
import { createLoginChallenge, consumeLoginChallenge, nonceHash } from './repository';
import { trustedReturnOrigin } from './policy';

const NONCE_COOKIE = 'gameshot_login_verifier';
export function validNativeRedirect(value: string) {
  const uri = new URL(value);
  const scheme = `manus${PRO_OFFER.bundleId.split('.').at(-1)!.slice(1)}:`;
  const path = `${uri.hostname ? `/${uri.hostname}` : ''}${uri.pathname}`;
  if (!uri.search && !uri.hash && uri.protocol === scheme && path === '/oauth/callback') return value;
  const packager = process.env.EXPO_PACKAGER_PROXY_URL ? new URL(process.env.EXPO_PACKAGER_PROXY_URL) : null;
  if (!uri.search && !uri.hash && ['exp:', 'exps:'].includes(uri.protocol) && uri.hostname === packager?.hostname && /^\/(?:--\/)?oauth\/callback$/.test(uri.pathname)) return value;
  throw new Error('Invalid native callback.');
}
function authorizationUrl(redirectUri: string, nonce: string) {
  const portal = process.env.MANUS_OAUTH_PORTAL_URL;
  if (!portal || !ENV.appId) throw new Error('Sign-in is not configured.');
  const url = new URL('/app-auth', portal);
  const state = Buffer.from(JSON.stringify({ redirectUri, nonce })).toString('base64');
  url.searchParams.set('appId', ENV.appId);
  url.searchParams.set('redirectUri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('responseType', 'code');
  return { url: url.toString(), state };
}
export function registerBillingLogin(app: Express) {
  app.get('/api/billing/login', async (req: Request, res: Response) => {
    try {
      const origin = trustedReturnOrigin(req.query.origin, trustedExpoWebOrigins());
      const redirectUri = `${origin}/oauth/callback`;
      const nonce = randomBytes(32).toString('hex');
      const verifier = randomBytes(32).toString('hex');
      await createLoginChallenge(nonce, redirectUri, 'web', nonceHash(verifier));
      res.cookie(NONCE_COOKIE, verifier, { ...getSessionCookieOptions(req), maxAge: 600000 });
      res.redirect(302, authorizationUrl(redirectUri, nonce).url);
    } catch { res.status(400).json({ error: 'Could not start secure sign-in. Open the app in a separate browser tab and retry.' }); }
  });
  app.post('/api/billing/login/start', async (req: Request, res: Response) => {
    try {
      const verifierHash = req.body?.verifierHash;
      if (typeof verifierHash !== 'string' || !/^[a-f0-9]{64}$/.test(verifierHash) || typeof req.body?.redirectUri !== 'string') throw new Error('Invalid sign-in request.');
      const redirectUri = validNativeRedirect(req.body.redirectUri);
      const nonce = randomBytes(32).toString('hex');
      await createLoginChallenge(nonce, redirectUri, 'native', verifierHash);
      res.json(authorizationUrl(redirectUri, nonce));
    } catch { res.status(400).json({ error: 'Could not start native sign-in.' }); }
  });
  app.post('/api/billing/login/complete', async (req: Request, res: Response) => {
    try {
      const { code, state, nativeVerifier } = req.body ?? {};
      if (typeof code !== 'string' || code.length > 4000 || typeof state !== 'string' || state.length > 8000) throw new Error('Missing login callback.');
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8')) as { redirectUri?: string; nonce?: string };
      if (typeof decoded.redirectUri !== 'string' || typeof decoded.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(decoded.nonce)) throw new Error('Invalid login state.');
      const cookieVerifier = parse(req.headers.cookie ?? '')[NONCE_COOKIE];
      const native = typeof nativeVerifier === 'string';
      const proof = native ? nativeVerifier : cookieVerifier;
      if (typeof proof !== 'string') throw new Error('Missing private login verifier.');
      const challenge = await consumeLoginChallenge(decoded.nonce, decoded.redirectUri, proof, native ? 'native' : 'web');
      res.clearCookie(NONCE_COOKIE, getSessionCookieOptions(req));
      const token = await sdk.exchangeCodeForToken(code, Buffer.from(challenge.redirectUri).toString('base64'));
      const info = await sdk.getUserInfo(token.accessToken);
      if (!info.openId) throw new Error('Identity unavailable.');
      await upsertUser({ openId: info.openId, name: info.name || 'GameShot user', email: info.email ?? null, loginMethod: info.loginMethod ?? info.platform ?? null, lastSignedIn: new Date() });
      const user = await getUserByOpenId(info.openId);
      if (!user) throw new Error('Account could not be saved.');
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || 'GameShot user', expiresInMs: ONE_YEAR_MS });
      res.cookie(getSessionCookieName(req), sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.json({ ...(native ? { sessionToken } : {}), user });
    } catch { res.status(400).json({ error: 'Sign-in could not be verified. Start sign-in again; your free crops are still available.' }); }
  });
}
