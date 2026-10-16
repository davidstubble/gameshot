import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_SETTINGS,
  DEFAULT_LAYOUT_SETTINGS,
  imagePlacement,
  MAX_CONTACT_SHEET_SOURCES,
  MAX_SOURCE_PIXELS,
  studioOutputName,
  validateImageSettings,
  validateLayoutSettings,
} from '../lib/studio/rules';

const imageSettings = (patch: Partial<typeof DEFAULT_IMAGE_SETTINGS> = {}) => ({ ...DEFAULT_IMAGE_SETTINGS, ...patch });
const layoutSettings = (patch: Partial<typeof DEFAULT_LAYOUT_SETTINGS> = {}) => ({ ...DEFAULT_LAYOUT_SETTINGS, ...patch });

describe('GameShot LABS image rules', () => {
  it('keeps inside output aspect-preserving and unpadded', () => {
    expect(imagePlacement({ width: 4000, height: 2000 }, imageSettings({ width: 1000, height: 1000, fit: 'inside' }))).toEqual({ width: 1000, height: 500, drawWidth: 1000, drawHeight: 500, x: 0, y: 0 });
  });

  it('keeps contain output exact while centering its preserved source pixels', () => {
    expect(imagePlacement({ width: 4000, height: 2000 }, imageSettings({ width: 1000, height: 1000, fit: 'contain' }))).toEqual({ width: 1000, height: 1000, drawWidth: 1000, drawHeight: 500, x: 0, y: 250 });
  });

  it('uses cover only as the explicit edge-cropping fit', () => {
    expect(imagePlacement({ width: 4000, height: 2000 }, imageSettings({ width: 1000, height: 1000, fit: 'cover' }))).toEqual({ width: 1000, height: 1000, drawWidth: 2000, drawHeight: 1000, x: -500, y: 0 });
  });

  it('does not silently enhance small sources when enlargement is disabled', () => {
    expect(imagePlacement({ width: 200, height: 100 }, imageSettings({ width: 1000, height: 1000, fit: 'inside', allowUpscale: false }))).toMatchObject({ width: 200, height: 100 });
    expect(() => imagePlacement({ width: 200, height: 100 }, imageSettings({ width: 1000, height: 1000, fit: 'cover', allowUpscale: false }))).toThrow('enlargement');
  });

  it('rejects invalid target dimensions, output area, and oversized sources', () => {
    expect(validateImageSettings(imageSettings({ width: 0 }))).toMatch('whole numbers');
    expect(validateImageSettings(imageSettings({ width: 8192, height: 8192 }))).toMatch('32 megapixels');
    expect(() => imagePlacement({ width: MAX_SOURCE_PIXELS + 1, height: 1 }, imageSettings())).toThrow('100 megapixels');
  });

  it('keeps JPEG quality at or above the readable-text floor', () => {
    expect(validateImageSettings(imageSettings({ quality: 0.8 }))).toMatch('95%');
    expect(validateImageSettings(imageSettings({ quality: 0.95 }))).toBeNull();
  });

  it('uses stable copy names with matching encodings and no source traversal', () => {
    expect(studioOutputName('../round.one.png', 'jpeg', 1, 12)).toBe('0002__round.one_lab.jpg');
    expect(studioOutputName('photo.heic', 'png', 0, 1)).toBe('0001_photo_lab.png');
  });
});

describe('GameShot LABS layout rules', () => {
  it('sets the requested reusable A4 two-column default', () => {
    expect(DEFAULT_LAYOUT_SETTINGS).toEqual({ paper: 'a4', orientation: 'portrait', columns: 2, captions: true, title: '' });
    expect(validateLayoutSettings(DEFAULT_LAYOUT_SETTINGS)).toBeNull();
  });

  it('supports a readable one-column layout and bounds layout inputs', () => {
    expect(validateLayoutSettings(layoutSettings({ columns: 1, title: 'Game captures' }))).toBeNull();
    expect(validateLayoutSettings(layoutSettings({ columns: 5 }))).toMatch('1 to 4');
    expect(validateLayoutSettings(layoutSettings({ title: 'x'.repeat(121) }))).toMatch('120 characters');
  });

  it('states a clear source-sheet bound', () => {
    expect(MAX_CONTACT_SHEET_SOURCES).toBe(12);
  });
});
