import { describe, expect, it } from 'vitest';
import { exportItems } from '../lib/crop/export-tools';
import { batchViewerItems } from '../lib/crop/viewer-tools';
import type { CropOutput } from '../lib/crop/types';
const outputs: CropOutput[] = Array.from({ length: 4 }, (_, i) => ({ id: `o${i + 1}`, sequence: i + 1, batchId: 'test', name: `old${i}.png`, sourceName: `IMG_${i}.PNG`, uri: `blob:${i}`, format: 'png', size: 1, width: 20, height: 10 }));
describe('batch versus selected-export preview', () => {
  it('labels selected images with their real ZIP number, not their full-batch position', () => {
    const batch = { outputs };
    const all = exportItems(batch);
    const selected = exportItems(batch, new Set(['o2', 'o4']));
    const viewer = batchViewerItems(all, selected);
    expect(viewer.map((item) => item.exportPosition)).toEqual([undefined, 1, undefined, 2]);
    expect(viewer[3].position).toBe(4);
    expect(viewer[3].name).toBe('0002_GameShot_test.png');
    expect(selected.map((item) => [item.output.uri, item.name])).toEqual([['blob:1', '0001_GameShot_test.png'], ['blob:3', '0002_GameShot_test.png']]);
  });
  it('custom order and selected preview follow exactly the same immutable ZIP items', () => {
    const batch = { outputs, order: ['o4', 'o3', 'o1', 'o2'] };
    const selected = exportItems(batch, new Set(['o1', 'o4']));
    const viewer = batchViewerItems(exportItems(batch), selected);
    expect(viewer.filter((item) => item.exportPosition).map((item) => [item.output.id, item.name])).toEqual(selected.map((item) => [item.output.id, item.name]));
    expect(selected.map((item) => item.output.id)).toEqual(['o4', 'o1']);
    expect(Object.isFrozen(selected)).toBe(true);
  });
  it('empty selection leaves all batch images excluded without changing original metadata', () => {
    const all = exportItems({ outputs });
    const viewer = batchViewerItems(all, []);
    expect(viewer.every((item) => item.exportPosition === undefined)).toBe(true);
    expect(all.every((item) => !('exportPosition' in item))).toBe(true);
    expect(outputs[0].name).toBe('old0.png');
  });
});
