import { describe, expect, it } from 'vitest';
import { exportItems, photoGroups } from '../lib/crop/export-tools';
import { galleryItemKey, gallerySelectionKey, successfulGalleryItems, orderReceipt, parseGroupSize, transferChecklist, transferGroups } from '../lib/crop/transfer';
import { runBatch } from '../lib/crop/batch';
import { DEFAULT_SETTINGS, type CropOutput, type SourceImage } from '../lib/crop/types';

const output = (n: number): CropOutput => ({ id: `o${n}`, sequence: n, batchId: 'b', name: `${String(n).padStart(4, '0')}_source${n}_cropped.png`, sourceName: `source${n}.png`, width: 10, height: 10, size: 1, uri: `file:///private/${n}`, format: 'png' });

describe('ordered transfer workflow', () => {
  it('retains appended imports, skips failures without reshuffling and maps final images back to inputs', async () => {
    const names = ['z-first.png', 'a-second.png', 'failed.png', 'later-added.png'];
    const sources: SourceImage[] = names.map((name, i) => ({ id: String(i), name, uri: `file:///${name}`, width: 6000, height: 3000 }));
    const result = await runBatch(sources, DEFAULT_SETTINGS, async (source, rect, settings, name, id) => {
      if (source.name === 'failed.png') throw new Error('invalid');
      return { ...output(1), id: source.id, name, sourceName: source.name, batchId: id, width: rect.width, height: rect.height, format: settings.format };
    }, () => false, () => {});
    const items = exportItems(result);
    expect(items.map((item) => item.output.sourceName)).toEqual(['z-first.png', 'a-second.png', 'later-added.png']);
    expect(orderReceipt(items).images.map((image) => image.importPosition)).toEqual([1, 2, 4]);
    expect(items.map((item) => item.name.slice(0, 4))).toEqual(['0001', '0002', '0003']);
    expect(items.map((item) => item.name).sort()).toEqual(items.map((item) => item.name));
  });
  it('custom order receipts reflect the exact selected subset, not original source name sorting', () => {
    const batch = { outputs: [output(1), output(2), output(3)], order: ['o3', 'o1', 'o2'] };
    const items = exportItems(batch, new Set(['o3', 'o1']));
    expect(items.map((item) => item.name)).toEqual(['0001_GameShot_b.png', '0002_GameShot_b.png']);
    const receipt = orderReceipt(items);
    expect(receipt.images.map((image) => [image.position, image.importPosition])).toEqual([[1, 3], [2, 1]]);
    expect(JSON.stringify(receipt)).not.toContain('file:///');
    expect(transferChecklist(items, 'YouTube')).toContain('images, not a video');
    expect(transferChecklist(items).indexOf(items[0].name)).toBeLessThan(transferChecklist(items).indexOf(items[1].name));
  });
  it('gallery tracking distinguishes selection, order and final filename without forgetting partial successes', () => {
    const original = exportItems({ outputs: [output(1), output(2)] });
    const reversed = exportItems({ outputs: [output(1), output(2)], order: ['o2', 'o1'] });
    expect(gallerySelectionKey(original)).not.toBe(gallerySelectionKey(reversed));
    expect(gallerySelectionKey(original)).not.toBe(gallerySelectionKey(original.slice(0, 1)));
    const signature = gallerySelectionKey(original);
    const saved = new Set([galleryItemKey(signature, original[0])]);
    expect(original.filter((item) => !saved.has(galleryItemKey(signature, item))).map((item) => item.output.id)).toEqual(['o2']);
  });
  it('leaves failed gallery images with colon-containing names retryable', () => {
    const items = [{ output: output(1), name: '0001_clip:final.png', position: 1 }, { output: output(2), name: '0002_clip.png', position: 2 }];
    expect(successfulGalleryItems(items, ['0001_clip:final.png: disk full']).map((item) => item.output.id)).toEqual(['o2']);
  });
  it('grouping preserves consecutive order and rejects invalid limits', () => {
    expect(transferGroups(5, '2')).toEqual([{ start: 1, end: 2 }, { start: 3, end: 4 }, { start: 5, end: 5 }]);
    for (const value of ['', '0', '-1', '1.5', 'Infinity', '1001']) expect(parseGroupSize(value)).toBeNull();
    expect(parseGroupSize('10')).toBe(10);
    for (const limit of [0, -1, 0.1, NaN, Infinity]) expect(photoGroups(5, limit)).toEqual([]);
  });
});
