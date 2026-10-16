import { describe, expect, it } from 'vitest';
import { capacityError, LIBRARY_LIMITS, readStoredBatch, summarize, toStoredBatch, type SavedBatchSummary } from '../lib/crop/library-rules';
import { createPreset, describePreset, PRESET_LIMIT, readPresets, upsertPreset } from '../lib/crop/preset-rules';
import { DEFAULT_SETTINGS, type BatchResult, type CropSettings } from '../lib/crop/types';

const batch = (id = 'b1', size = 1000): BatchResult => ({
  id, createdAt: 1, total: 2, cancelled: false, errors: [{ name: 'bad.png', message: 'too small' }],
  outputs: [1, 2].map((sequence) => ({ id: `${id}-${sequence}`, sequence, sourceName: `s${sequence}.png`, name: `000${sequence}_s${sequence}_cropped.png`, uri: `blob:${sequence}`, width: 300, height: 200, size, format: 'png', batchId: id })),
});
const summary = (id: string, bytes = 1): SavedBatchSummary => ({ ...summarize(batch(id), 5), bytes });

describe('device library rules', () => {
  it('stores metadata without session-only URIs', () => {
    const stored = toStoredBatch({ ...batch(), order: ['b1-2', 'b1-1'] }, 9);
    expect(stored.summary).toMatchObject({ id: 'b1', savedAt: 9, count: 2, bytes: 2000, skipped: 1, width: 300, height: 200 });
    expect(stored.outputs.every((output) => !('uri' in output))).toBe(true);
    expect(readStoredBatch(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });
  it('enforces the batch-count and byte limits but allows re-saving the same batch', () => {
    const full = Array.from({ length: LIBRARY_LIMITS.batches }, (_, i) => summary(`b${i}`));
    expect(capacityError(full, summary('new'))).toMatch(/holds 20 batches/);
    expect(capacityError(full, summary('b3'))).toBeNull();
    expect(capacityError([summary('a', LIBRARY_LIMITS.bytes - 10)], summary('new', 11))).toMatch(/Not enough library space/);
    expect(capacityError([summary('a', LIBRARY_LIMITS.bytes - 10)], summary('new', 10))).toBeNull();
    expect(capacityError([], { ...summary('empty'), count: 0 })).toMatch(/no finished images/);
  });
  it('rejects corrupt records and file names that could address another folder', () => {
    const stored = toStoredBatch(batch());
    expect(readStoredBatch(null)).toBeNull();
    expect(readStoredBatch({ ...stored, summary: { ...stored.summary, id: '../x' } })).toBeNull();
    expect(readStoredBatch({ ...stored, outputs: [{ ...stored.outputs[0], name: '../../secret.png' }] })).toBeNull();
    expect(readStoredBatch({ ...stored, outputs: [{ ...stored.outputs[0], batchId: 'other' }] })).toBeNull();
    expect(readStoredBatch({ ...stored, outputs: [] })).toBeNull();
  });
});

const pixels: CropSettings = { ...DEFAULT_SETTINGS, mode: 'pixels', width: '1920', height: '1080', x: '10', y: '20' };
describe('saved crop presets', () => {
  it('saves a validated pixel crop and describes it', () => {
    const preset = createPreset('  Valorant   scoreboard ', pixels, [], 100);
    expect(preset.name).toBe('Valorant scoreboard');
    expect(preset.settings).toMatchObject({ mode: 'pixels', width: '1920', height: '1080', x: '10', y: '20', format: 'png' });
    expect(describePreset(preset)).toBe('1920 × 1080 px · X 10 Y 20 · PNG');
  });
  it('rejects unnamed, locked-preset and invalid crops', () => {
    expect(() => createPreset('  ', pixels, [])).toThrow(/name/);
    expect(() => createPreset('x', DEFAULT_SETTINGS, [])).toThrow(/Pixels or Aspect ratio/);
    expect(() => createPreset('x', { ...pixels, width: '0' }, [])).toThrow(/Width/);
    expect(() => createPreset('x', { ...DEFAULT_SETTINGS, mode: 'ratio', ratioWidth: 'abc' }, [])).toThrow(/aspect ratio/);
  });
  it('replaces same-name presets and enforces the limit for new names', () => {
    const first = createPreset('Fortnite', pixels, [], 1);
    const replaced = createPreset('fortnite', { ...pixels, width: '1280' }, [first], 2);
    expect(replaced.id).toBe(first.id);
    expect(upsertPreset([first], replaced)).toHaveLength(1);
    const full = Array.from({ length: PRESET_LIMIT }, (_, i) => createPreset(`p${i}`, pixels, [], i));
    expect(() => createPreset('one more', pixels, full)).toThrow(/30 saved crops/);
    expect(() => createPreset('p3', pixels, full)).not.toThrow();
  });
  it('ignores corrupt or invalid stored presets', () => {
    const good = createPreset('Ratio', { ...DEFAULT_SETTINGS, mode: 'ratio', ratioWidth: '9', ratioHeight: '16', scale: 0.8 }, [], 1);
    const loaded = readPresets([good, null, { id: 'x' }, { ...good, id: 'bad', settings: { ...good.settings, mode: 'preset' } }, { ...good, id: 'bad2', settings: { ...good.settings, ratioWidth: '-1' } }]);
    expect(loaded).toEqual([good]);
    expect(describePreset(good)).toBe('9:16 · 80% · PNG');
    expect(readPresets('nope')).toEqual([]);
  });
});
