import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportItems } from '../lib/crop/export-tools';
import type { BatchResult, CropOutput } from '../lib/crop/types';

const output = (batchId: string, sequence: number, size = 4): CropOutput => ({
  id: `${batchId}-${sequence}`, sequence, sourceName: `s${sequence}.png`, name: `000${sequence}_s${sequence}_cropped.png`,
  uri: `blob:${batchId}-${sequence}`, width: 10, height: 10, size, format: 'png', batchId,
});
const batch = (id: string, count = 2): BatchResult => ({
  id, createdAt: 1, total: count, cancelled: false, errors: [],
  outputs: Array.from({ length: count }, (_, i) => output(id, i + 1)),
});

let urls = 0;
beforeEach(() => {
  urls = 0;
  vi.stubGlobal('URL', { createObjectURL: () => `blob:opened-${++urls}`, revokeObjectURL: vi.fn() });
  vi.stubGlobal('fetch', vi.fn(async (uri: string) => new Response(new Blob([new TextEncoder().encode(uri)], { type: 'image/png' }))));
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.resetModules();
  await new Promise<void>((resolve) => { const r = indexedDB.deleteDatabase('gameshot-library'); r.onsuccess = r.onerror = r.onblocked = () => resolve(); });
});

describe('browser device library (IndexedDB)', () => {
  it('keeps, lists, reopens with real image bytes, and removes a batch', async () => {
    const library = await import('../lib/crop/local-library.web');
    const saved = await library.keepBatch({ ...batch('b1'), order: ['b1-2', 'b1-1'] });
    expect(saved).toMatchObject({ id: 'b1', count: 2, bytes: 8 });
    expect((await library.listSaved()).map((item) => item.id)).toEqual(['b1']);
    vi.resetModules();
    const fresh = await import('../lib/crop/local-library.web'); // simulates a page refresh
    const opened = await fresh.openSaved('b1');
    expect(opened.order).toEqual(['b1-2', 'b1-1']);
    expect(opened.outputs.map((o) => o.uri)).toEqual(['blob:opened-1', 'blob:opened-2']);
    const platform = await import('../lib/crop/platform.web');
    const blob = await platform.outputBlob(opened.outputs[0]);
    expect(await blob.text()).toBe('blob:b1-1');
    await fresh.updateSavedOrder('b1', undefined);
    expect((await fresh.openSaved('b1')).order).toBeUndefined();
    await expect(fresh.removeSaved('b1')).resolves.toEqual({ sessionCopyRemoved: false });
    expect(await fresh.listSaved()).toEqual([]);
    await expect(fresh.openSaved('b1')).rejects.toThrow(/no longer in this browser/);
  });
  it('refuses new batches past the library limit without storing partial data', async () => {
    const library = await import('../lib/crop/local-library.web');
    for (let i = 0; i < 20; i++) await library.keepBatch(batch(`b${i}`, 1));
    await expect(library.keepBatch(batch('extra', 1))).rejects.toThrow(/holds 20 batches/);
    expect(await library.listSaved()).toHaveLength(20);
  });
});

type Written = Record<string, Record<string, string>>;
function fakeRoot(existing: string[] = [], failOn?: string) {
  const written: Written = {};
  const root = {
    name: 'Pictures',
    async getDirectoryHandle(name: string, options?: { create?: boolean }) {
      if (!options?.create) {
        if (existing.includes(name) || written[name]) return root;
        throw Object.assign(new Error('missing'), { name: 'NotFoundError' });
      }
      if (written[name] || existing.includes(name)) throw new Error('would reuse an existing folder');
      written[name] = {};
      return {
        name,
        getDirectoryHandle: root.getDirectoryHandle,
        async getFileHandle(file: string, opts?: { create?: boolean }) {
          if (!opts?.create) throw new Error('unexpected');
          if (file in written[name]) throw new Error('would overwrite');
          return { async createWritable() {
            return { async write(data: Blob) { if (file === failOn) throw Object.assign(new Error('disk'), { name: 'QuotaExceededError' }); written[name][file] = await data.text(); }, async close() {}, async abort() {} };
          } };
        },
      };
    },
  };
  return { root, written };
}

describe('save to folder (desktop browsers)', () => {
  it('writes separate files in posting order into a new dated subfolder', async () => {
    const { root, written } = fakeRoot(['GameShot-2026-10-14-1003']);
    vi.stubGlobal('window', { isSecureContext: true, showDirectoryPicker: vi.fn(async () => root) });
    const platform = await import('../lib/crop/platform.web');
    expect(platform.supportsFolderSave()).toBe(true);
    const items = exportItems({ outputs: batch('b').outputs, order: ['b-2', 'b-1'] });
    const result = await platform.saveToFolder(items, new Date(2026, 9, 14, 10, 3));
    expect(result).toEqual({ folder: 'Pictures/GameShot-2026-10-14-1003-2', saved: 2, errors: [] });
    expect(Object.keys(written['GameShot-2026-10-14-1003-2'])).toEqual(['0001_GameShot_b.png', '0002_GameShot_b.png']);
    expect(written['GameShot-2026-10-14-1003-2']['0001_GameShot_b.png']).toBe('blob:b-2');
  });
  it('reports partial write failures and treats a closed picker as cancel', async () => {
    const { root } = fakeRoot([], '0002_GameShot_b.png');
    const picker = vi.fn(async () => root);
    vi.stubGlobal('window', { isSecureContext: true, showDirectoryPicker: picker });
    const platform = await import('../lib/crop/platform.web');
    const result = await platform.saveToFolder(exportItems(batch('b')));
    expect(result?.saved).toBe(1);
    expect(result?.errors).toEqual(['0002_GameShot_b.png: Not enough disk space.']);
    picker.mockRejectedValueOnce(Object.assign(new Error('closed'), { name: 'AbortError' }));
    await expect(platform.saveToFolder(exportItems(batch('b')))).resolves.toBeNull();
    picker.mockRejectedValueOnce(Object.assign(new Error('iframe'), { name: 'SecurityError' }));
    await expect(platform.saveToFolder(exportItems(batch('b')))).rejects.toThrow(/own tab/);
  });
  it('is unavailable without the directory picker (Firefox, Safari) or outside secure pages', async () => {
    vi.stubGlobal('window', { isSecureContext: true });
    const platform = await import('../lib/crop/platform.web');
    expect(platform.supportsFolderSave()).toBe(false);
    await expect(platform.saveToFolder(exportItems(batch('b')))).rejects.toThrow(/Download ZIP/);
    vi.stubGlobal('window', { isSecureContext: false, showDirectoryPicker: vi.fn() });
    expect(platform.supportsFolderSave()).toBe(false);
  });
});
