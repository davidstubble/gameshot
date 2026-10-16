import { describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
vi.mock('../server/_core/env', () => ({ ENV: { appId: 'expected-project', cookieSecret: 'unit-signing-key-with-sufficient-length', oAuthServerUrl: '', ownerOpenId: '' } }));
import { sdk } from '../server/_core/sdk';
const key = new TextEncoder().encode('unit-signing-key-with-sufficient-length');
async function token(patch: Record<string, unknown> = {}, expiry: string | null = '1h', algorithm = 'HS256') {
  const jwt = new SignJWT({ openId: 'unit-user', appId: 'expected-project', name: 'Unit user', ...patch }).setProtectedHeader({ alg: algorithm }).setIssuedAt();
  if (expiry) jwt.setExpirationTime(expiry);
  return jwt.sign(key);
}
describe('paid account session verification', () => {
  it('accepts a signed current session for this project', async () => {
    expect(await sdk.verifySession(await token())).toMatchObject({ openId: 'unit-user', appId: 'expected-project' });
  });
  it('rejects a session from another project', async () => { expect(await sdk.verifySession(await token({ appId: 'other-project' }))).toBeNull(); });
  it('requires an expiry and rejects expired sessions', async () => {
    expect(await sdk.verifySession(await token({}, null))).toBeNull();
    expect(await sdk.verifySession(await token({}, '-1h'))).toBeNull();
  });
  it('rejects other algorithms or unsigned data', async () => {
    expect(await sdk.verifySession(await token({}, '1h', 'HS384'))).toBeNull();
    expect(await sdk.verifySession('unsigned.data')).toBeNull();
  });
  it('requires a real identity but does not reject an empty display name', async () => {
    expect(await sdk.verifySession(await token({ openId: '' }))).toBeNull();
    expect(await sdk.verifySession(await token({ name: '' }))).not.toBeNull();
  });
});
