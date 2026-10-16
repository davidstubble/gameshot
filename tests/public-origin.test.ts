import { afterEach, describe, expect, it, vi } from 'vitest';
import { trustedExpoWebOrigins } from '../server/_core/cors';
import { configuredPublicOrigin } from '../server/web/routes';
import { PUBLIC_SITE } from '../shared/public-site';

afterEach(() => vi.unstubAllEnvs());

describe('published production origin', () => {
  it('is a secure, normalized origin owned by the deployment', () => {
    expect(PUBLIC_SITE.origin).toBe('https://gameshot-okddvuhx.manus.space');
    expect(configuredPublicOrigin()).toBe('https://gameshot-okddvuhx.manus.space');
  });
  it('is trusted for sign-in and Checkout returns alongside the preview origins', () => {
    vi.stubEnv('EXPO_PACKAGER_PROXY_URL', '');
    vi.stubEnv('EXPO_WEB_PREVIEW_URL', '');
    vi.stubEnv('PUBLIC_APP_ORIGIN', '');
    expect([...trustedExpoWebOrigins()]).toEqual([
      'https://gameshot-okddvuhx.manus.space',
      'https://gameshotlabs.com',
      'https://www.gameshotlabs.com',
    ]);
  });
  it('does not trust an arbitrary or insecure runtime override', () => {
    vi.stubEnv('EXPO_PACKAGER_PROXY_URL', '');
    vi.stubEnv('EXPO_WEB_PREVIEW_URL', '');
    vi.stubEnv('PUBLIC_APP_ORIGIN', 'http://localhost:8081');
    expect([...trustedExpoWebOrigins()]).not.toContain('http://localhost:8081');
    expect([...trustedExpoWebOrigins()]).not.toContain('https://evil.example');
  });
});
