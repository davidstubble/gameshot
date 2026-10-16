import { describe, expect, it } from 'vitest';
import { nonceHash, verifierMatches } from '../server/billing/repository';

describe('private login-verifier proof', () => {
  const publicNonce = '2'.repeat(64);
  const privateVerifier = '1'.repeat(64);
  const storedHash = nonceHash(privateVerifier);
  it('accepts only the separately held private verifier', () => {
    expect(verifierMatches(privateVerifier, storedHash)).toBe(true);
  });
  it('does not accept an intercepted callback state nonce as the verifier', () => {
    const state = btoa(JSON.stringify({ redirectUri: 'manus070466106350822:///oauth/callback', nonce: publicNonce }));
    const intercepted = JSON.parse(atob(state)) as { nonce: string };
    expect(verifierMatches(intercepted.nonce, storedHash)).toBe(false);
    expect(state).not.toContain(privateVerifier);
  });
  it('rejects missing legacy proof, wrong hashes, and malformed verifiers', () => {
    expect(verifierMatches(privateVerifier, null)).toBe(false);
    expect(verifierMatches(privateVerifier, nonceHash('3'.repeat(64)))).toBe(false);
    expect(verifierMatches('not-a-proof', storedHash)).toBe(false);
  });
});
