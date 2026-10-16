import { describe, expect, it } from 'vitest';
import { exportItems, snapshotExportItems } from '../lib/crop/export-tools';
import { orderReceipt } from '../lib/crop/transfer';
import type { CropOutput } from '../lib/crop/types';

const output = (n: number, format: 'png' | 'jpeg' = 'png'): CropOutput => ({
  id: `o${n}`, sequence: n, sourceName: `same-original.jpg`, name: 'legacy-duplicate.jpg',
  uri: `blob:o${n}`, batchId: 'batch', format, size: 3, width: 20, height: 10,
});

describe('canonical selected export snapshot', () => {
  it('keeps 12 imports in numeric/name order even when completion order is reversed', () => {
    const outputs = Array.from({ length: 12 }, (_, i) => output(i + 1)).reverse();
    const items = exportItems({ outputs });
    expect(items.map((item) => item.output.id)).toEqual(Array.from({ length: 12 }, (_, i) => `o${i + 1}`));
    expect(items[0].name).toBe('0001_GameShot_batch.png');
    expect(items.at(-1)?.name).toBe('0012_GameShot_batch.png');
    expect(items.map((item) => item.name).sort()).toEqual(items.map((item) => item.name));
    expect(new Set(items.map((item) => item.name)).size).toBe(12);
  });
  it('numbers a preferred-order subset from one and keeps import positions in the receipt', () => {
    const items = exportItems({ outputs: [output(1), output(2), output(3)], order: ['o3', 'o1', 'o2'] }, new Set(['o2', 'o3']));
    expect(items.map((item) => [item.output.id, item.name])).toEqual([
      ['o3', '0001_GameShot_batch.png'], ['o2', '0002_GameShot_batch.png'],
    ]);
    expect(orderReceipt(items).images.map((item) => [item.position, item.importPosition])).toEqual([[1, 3], [2, 2]]);
  });
  it('freezes copied metadata without freezing/mutating internal crops or caller order', () => {
    const outputs = [output(1), output(2)];
    const order = ['o2', 'o1'];
    const items = exportItems({ outputs, order });
    order.reverse(); outputs.reverse(); outputs[0].uri = 'blob:changed'; outputs[0].name = 'changed.jpg';
    expect(items.map((item) => item.output.uri)).toEqual(['blob:o2', 'blob:o1']);
    expect(items.map((item) => item.output.name)).toEqual(['legacy-duplicate.jpg', 'legacy-duplicate.jpg']);
    expect(Object.isFrozen(items)).toBe(true);
    expect(Object.isFrozen(items[0])).toBe(true);
    expect(Object.isFrozen(items[0].output)).toBe(true);
    expect(Object.isFrozen(outputs[0])).toBe(false);
  });
  it('uses actual png/jpg format, not an unreliable legacy extension; no pixels are changed', () => {
    const original = [output(1), output(2, 'jpeg')];
    const items = exportItems({ outputs: original });
    expect(items.map((item) => item.name)).toEqual(['0001_GameShot_batch.png', '0002_GameShot_batch.jpg']);
    expect(original.map((item) => item.name)).toEqual(['legacy-duplicate.jpg', 'legacy-duplicate.jpg']);
    expect(items.map((item) => [item.output.uri, item.output.width, item.output.height])).toEqual([['blob:o1', 20, 10], ['blob:o2', 20, 10]]);
  });
  it('widens all prefixes together beyond 9999 and keeps them unique', () => {
    const items = exportItems({ outputs: Array.from({ length: 10000 }, (_, i) => output(i + 1)) });
    expect(items[0].name).toBe('00001_GameShot_batch.png');
    expect(items.at(-1)?.name).toBe('10000_GameShot_batch.png');
    expect(items.map((item) => item.name).sort()).toEqual(items.map((item) => item.name));
  });
  it('snapshots a retry subset without resetting its assigned filename or position', () => {
    const items = exportItems({ outputs: [output(1), output(2), output(3)] });
    const retry = snapshotExportItems([items[2]]);
    expect(retry[0].name).toBe('0003_GameShot_batch.png');
    expect(orderReceipt(retry).images[0].position).toBe(3);
  });
  it('distinguishes filesystem-safe versions of unsafe legacy batch IDs', () => {
    const first = exportItems({ outputs: [{ ...output(1), batchId: 'unsafe/id' }] });
    const second = exportItems({ outputs: [{ ...output(1), batchId: 'unsafe:id' }] });
    expect(first[0].name).not.toBe(second[0].name);
    expect(first[0].name).toMatch(/^0001_GameShot_[A-Za-z0-9_-]+\.png$/);
  });
});
