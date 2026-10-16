import { describe, expect, it } from 'vitest';
import { APPROVED_PRICING } from '../shared/pricing';

describe('approved GameShot LABS pricing catalog', () => {
  it('keeps the free three-image entry point', () => {
    expect(APPROVED_PRICING.free.amountCents).toBe(0);
    expect(APPROVED_PRICING.free.displayPrice).toBe('$0');
    expect(APPROVED_PRICING.free.features).toContain('3 images per batch');
  });

  it('contains the approved one-time pack prices', () => {
    expect(APPROVED_PRICING.crop).toMatchObject({ amountCents: 799, displayPrice: '$7.99', kind: 'one_time' });
    expect(APPROVED_PRICING.creator).toMatchObject({ amountCents: 999, displayPrice: '$9.99', kind: 'one_time' });
    expect(APPROVED_PRICING.layout).toMatchObject({ amountCents: 999, displayPrice: '$9.99', kind: 'one_time' });
    expect(APPROVED_PRICING.privacy).toMatchObject({ amountCents: 999, displayPrice: '$9.99', kind: 'one_time' });
    expect(APPROVED_PRICING.studio).toMatchObject({ amountCents: 1999, displayPrice: '$19.99 early / $29.99 standard', kind: 'one_time' });
  });

  it('does not mark unconfigured packs as purchasable', () => {
    for (const key of ['crop', 'creator', 'layout', 'privacy', 'studio'] as const) {
      expect(APPROVED_PRICING[key].availability).toBe('planned');
    }
    expect(APPROVED_PRICING.giftTheme.kind).toBe('virtual_good');
    expect(APPROVED_PRICING.giftTheme.amountCents).toBeNull();
  });
});
