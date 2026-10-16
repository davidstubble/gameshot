import { describe, expect, it, vi } from 'vitest';
import { dragCrop, getCropRect, outputName, PRO_PRESET, validateSettings } from '../lib/crop/geometry';
import { runBatch } from '../lib/crop/batch';
import { DEFAULT_SETTINGS, type CropOutput, type CropSettings, type SourceImage } from '../lib/crop/types';
const settings = (patch: Partial<CropSettings> = {}): CropSettings => ({ ...DEFAULT_SETTINGS, ...patch });
const source = (id = '1', width = 5120, height = 2880): SourceImage => ({ id, width, height, uri: `file://${id}.png`, name: `image-${id}.png` });

describe('source-pixel crop geometry', () => {
  it('uses the original preset unchanged on different resolutions', () => {
    expect(getCropRect(source(), settings())).toEqual(PRO_PRESET);
    expect(getCropRect(source('large', 7680, 4320), settings())).toEqual(PRO_PRESET);
  });
  it('fits exactly at the minimum preset bounds', () => {
    expect(getCropRect(source('edge', 4838, 2270), settings())).toEqual(PRO_PRESET);
    expect(() => getCropRect(source('small', 4837, 2270), settings())).toThrow('doesn\'t fit');
  });
  it('does not silently scale or clamp a too-small exact crop', () => {
    expect(() => getCropRect(source('small', 1920, 1080), settings())).toThrow('4838 × 2270');
  });
  it('uses exact custom dimensions and offsets', () => {
    expect(getCropRect(source(), settings({ mode: 'pixels', width: '1200', height: '600', x: '40', y: '50' }))).toEqual({ width: 1200, height: 600, x: 40, y: 50 });
  });
  it('centers separately on each image and ignores unused offsets', () => {
    const custom = settings({ mode: 'pixels', width: '600', height: '400', centered: true, x: '', y: '' });
    expect(getCropRect(source('center', 1000, 800), custom)).toEqual({ width: 600, height: 400, x: 200, y: 200 });
  });
  it.each([{ width: '0' }, { height: '-4' }, { width: '12.5' }, { x: '-1' }, { y: '' }, { width: '1e4' }])('rejects invalid exact input %j', (patch) => {
    expect(validateSettings(settings({ mode: 'pixels', ...patch }))).not.toBeNull();
  });
  it('fits a largest centered square in landscape without resizing', () => {
    expect(getCropRect(source('square', 1920, 1080), settings({ mode: 'ratio', ratioWidth: '1', ratioHeight: '1' }))).toEqual({ width: 1080, height: 1080, x: 420, y: 0 });
  });
  it('fits portrait 9:16 in a landscape source', () => {
    const rect = getCropRect(source('portrait', 1920, 1080), settings({ mode: 'ratio', ratioWidth: '9', ratioHeight: '16' }));
    expect(rect.width).toBe(607); expect(rect.height).toBe(1079);
    expect(Math.abs(rect.width - rect.height * 9 / 16)).toBeLessThan(1);
  });
  it('accepts a user decimal ratio', () => {
    const rect = getCropRect(source('decimal', 1800, 1200), settings({ mode: 'ratio', ratioWidth: '4.5', ratioHeight: '3' }));
    expect(rect).toEqual({ x: 0, y: 0, width: 1800, height: 1200 });
  });
  it.each([{ ratioWidth: '0' }, { ratioHeight: '0' }, { ratioWidth: 'abc' }, { ratioWidth: 'Infinity' }])('rejects invalid ratio %j', (patch) => {
    expect(validateSettings(settings({ mode: 'ratio', ...patch }))).not.toBeNull();
  });
  it('maps ratio position proportionally across sizes and clamps dragging', () => {
    const custom = settings({ mode: 'ratio', ratioWidth: '1', ratioHeight: '1', anchorX: 1 });
    expect(getCropRect(source('a', 1920, 1080), custom).x).toBe(840);
    expect(getCropRect(source('b', 3840, 2160), custom).x).toBe(1680);
    const patch = dragCrop(source('a', 1920, 1080), custom, getCropRect(source('a', 1920, 1080), custom), -9999, 9999);
    expect(patch.anchorX).toBe(0);
  });
  it('supports a smaller ratio-locked crop and locked preset dragging', () => {
    const rect = getCropRect(source('half', 1600, 900), settings({ mode: 'ratio', scale: 0.5 }));
    expect(rect).toEqual({ width: 800, height: 450, x: 400, y: 225 });
    expect(dragCrop(source(), settings(), PRO_PRESET, 100, 100)).toEqual({});
  });
  it('keeps crop bounds and positive dimensions over mixed sizes and ratios', () => {
    for (const [width, height] of [[100, 900], [1920, 1080], [4032, 3024], [1, 1]]) {
      for (const ratio of ['16:9', '9:16', '1:1', '4.5:3']) {
        const [ratioWidth, ratioHeight] = ratio.split(':');
        const rect = getCropRect({ width, height }, settings({ mode: 'ratio', ratioWidth, ratioHeight, scale: 0.72, anchorX: 1, anchorY: 1 }));
        expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.width).toBeGreaterThan(0); expect(rect.height).toBeGreaterThan(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width); expect(rect.y + rect.height).toBeLessThanOrEqual(height);
      }
    }
  });
  it('matches extensions to formats, preserves basename, and avoids traversal/collisions', () => {
    expect(outputName('match.jpg', 'png', 0)).toBe('0001_match_cropped.png');
    expect(outputName('../match.png', 'jpeg', 1)).toBe('0002__match_cropped.jpg');
    expect(outputName('match.jpg', 'png', 1)).not.toBe(outputName('match.jpg', 'png', 0));
  });
});

describe('sequential batch processing', () => {
  const executor = vi.fn(async (image, rect, config, name, batchId): Promise<CropOutput> => ({ id: image.id, sourceName: image.name, name, batchId, uri: 'file://new-copy.png', size: 100, width: rect.width, height: rect.height, format: config.format }));
  it('skips invalid sources but preserves actual successes and matching output metadata', async () => {
    executor.mockClear();
    const progress = vi.fn();
    const result = await runBatch([source(), source('small', 1920, 1080), source('3')], settings(), executor, () => false, progress);
    expect(result.outputs).toHaveLength(2); expect(result.errors).toHaveLength(1);
    expect(executor).toHaveBeenCalledTimes(2); expect(progress).toHaveBeenLastCalledWith(3, 'image-3.png');
  });
  it('isolates a codec failure', async () => {
    const crop = vi.fn().mockRejectedValueOnce(new Error('Bad codec')).mockImplementationOnce(executor);
    const result = await runBatch([source('1'), source('2')], settings(), crop, () => false, () => {});
    expect(result.errors[0].message).toBe('Bad codec'); expect(result.outputs).toHaveLength(1);
  });
  it('cancels between files and keeps the first completed output', async () => {
    let cancelled = false;
    const crop = vi.fn(async (...args: Parameters<typeof executor>) => { cancelled = true; return executor(...args); });
    const result = await runBatch([source(), source('2')], settings(), crop, () => cancelled, () => {});
    expect(result.cancelled).toBe(true); expect(result.outputs).toHaveLength(1); expect(crop).toHaveBeenCalledTimes(1);
  });
  it('rejects outputs with wrong dimensions', async () => {
    const bad = vi.fn(async (...args: Parameters<typeof executor>) => ({ ...(await executor(...args)), width: 1 }));
    const result = await runBatch([source()], settings(), bad, () => false, () => {});
    expect(result.outputs).toHaveLength(0); expect(result.errors[0].message).toMatch('dimensions');
  });
});
