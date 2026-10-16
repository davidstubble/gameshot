import { describe, expect, it } from 'vitest';
import { exportFolderName, exportItems, isCustomOrder, moveInOrder, normalizeOrder, orderedOutputs, photoGroups, stripSequence } from '../lib/crop/export-tools';
import type { CropOutput } from '../lib/crop/types';

const output = (sequence: number, base = `shot-${sequence}`): CropOutput => ({
  id: `id-${sequence}`, sequence, sourceName: `${base}.png`, name: `${String(sequence).padStart(4, '0')}_${base}_cropped.png`,
  uri: `blob:${sequence}`, width: 100, height: 50, size: 10, format: 'png', batchId: 'b',
});
const outputs = [output(2), output(1), output(3)];

describe('posting order', () => {
  it('uses import order when no custom order is set', () => {
    expect(orderedOutputs({ outputs }).map((o) => o.sequence)).toEqual([1, 2, 3]);
    expect(isCustomOrder({ outputs })).toBe(false);
  });
  it('applies a complete custom order', () => {
    const batch = { outputs, order: ['id-3', 'id-1', 'id-2'] };
    expect(orderedOutputs(batch).map((o) => o.id)).toEqual(['id-3', 'id-1', 'id-2']);
    expect(isCustomOrder(batch)).toBe(true);
  });
  it('ignores stale, partial, duplicated or import-identical orders', () => {
    expect(normalizeOrder(outputs, ['id-1', 'id-2'])).toBeUndefined();
    expect(normalizeOrder(outputs, ['id-1', 'id-1', 'id-2'])).toBeUndefined();
    expect(normalizeOrder(outputs, ['id-1', 'id-2', 'id-9'])).toBeUndefined();
    expect(normalizeOrder(outputs, ['id-1', 'id-2', 'id-3'])).toBeUndefined();
    expect(orderedOutputs({ outputs, order: ['id-9'] }).map((o) => o.sequence)).toEqual([1, 2, 3]);
  });
  it('moves one item without mutating the input and ignores out-of-range moves', () => {
    const order = ['a', 'b', 'c'];
    expect(moveInOrder(order, 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveInOrder(order, 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(moveInOrder(order, 'a', -1)).toEqual(order);
    expect(moveInOrder(order, 'x', 1)).toEqual(order);
    expect(order).toEqual(['a', 'b', 'c']);
  });
});

describe('export items', () => {
  it('numbers final export names in import order', () => {
    expect(exportItems({ outputs }).map((i) => [i.position, i.name])).toEqual([
      [1, '0001_GameShot_b.png'], [2, '0002_GameShot_b.png'], [3, '0003_GameShot_b.png'],
    ]);
  });
  it('renumbers a selected subset from one without gaps', () => {
    expect(exportItems({ outputs }, new Set(['id-1', 'id-3'])).map((i) => i.name)).toEqual(['0001_GameShot_b.png', '0002_GameShot_b.png']);
  });
  it('renumbers names to match a chosen order and selection', () => {
    const items = exportItems({ outputs, order: ['id-3', 'id-1', 'id-2'] }, new Set(['id-3', 'id-2']));
    expect(items.map((i) => i.name)).toEqual(['0001_GameShot_b.png', '0002_GameShot_b.png']);
    expect(items.map((i) => i.output.name)).toEqual(['0003_shot-3_cropped.png', '0002_shot-2_cropped.png']);
    expect([...items.map((i) => i.name)].sort()).toEqual(items.map((i) => i.name));
  });
  it('returns nothing for an empty selection', () => {
    expect(exportItems({ outputs }, new Set())).toEqual([]);
  });
  it('strips only a leading sequence prefix', () => {
    expect(stripSequence('0012_round_2_cropped.png')).toBe('round_2_cropped.png');
    expect(stripSequence('round_2_cropped.png')).toBe('round_2_cropped.png');
  });
});

describe('posting groups and folders', () => {
  it('splits batches into TikTok-sized groups', () => {
    expect(photoGroups(0)).toEqual([]);
    expect(photoGroups(35)).toEqual([{ start: 1, end: 35 }]);
    expect(photoGroups(36)).toEqual([{ start: 1, end: 35 }, { start: 36, end: 36 }]);
    expect(photoGroups(71)).toEqual([{ start: 1, end: 35 }, { start: 36, end: 70 }, { start: 71, end: 71 }]);
  });
  it('builds a dated, filesystem-safe export folder name', () => {
    expect(exportFolderName(new Date(2026, 9, 4, 7, 5))).toBe('GameShot-2026-10-04-0705');
  });
});
