import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unzipSync } from 'fflate';
import { exportItems, type ExportItem } from '../lib/crop/export-tools';
import type { CropOutput } from '../lib/crop/types';

const output = (n: number): CropOutput => ({ id: `o${n}`, sequence: n, batchId: 'test', name: `legacy-${n}.png`, sourceName: `s${n}.png`, uri: `blob:${n}`, width: 10, height: 10, size: 1, format: 'png' });
const mutable = (items: readonly ExportItem[]) => items.map((item) => ({ ...item, output: { ...item.output } }));
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };

function downloadHarness() {
  const blobs: Blob[] = [], links: { href: string; download: string; click: () => void; remove: () => void }[] = [];
  vi.stubGlobal('URL', { createObjectURL: (blob: Blob) => { blobs.push(blob); return `blob:download-${blobs.length}`; }, revokeObjectURL: vi.fn() });
  vi.stubGlobal('document', { body: { appendChild() {} }, createElement: () => { const link = { href: '', download: '', click() {}, remove() {} }; links.push(link); return link; } });
  return { blobs, links };
}
beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('numbered browser export adapters', () => {
  it('shares 12 real files in preferred selected order after blob preparation completes backwards', async () => {
    const platform = await import('../lib/crop/platform.web');
    const completed: CropOutput[] = [];
    const gates = Array.from({ length: 12 }, () => deferred<void>());
    const prep = gates.map((gate, i) => gate.promise.then(() => {
      const o = output(i + 1);
      platform.registerOutputFile(o, new Blob([new Uint8Array([i + 1])], { type: 'image/png' }));
      completed.push(o);
    }));
    for (const gate of [...gates].reverse()) gate.resolve();
    await Promise.all(prep);
    expect(completed.map((o) => o.sequence)).toEqual(Array.from({ length: 12 }, (_, i) => 12 - i));
    const order = ['o12', 'o10', 'o2', ...Array.from({ length: 12 }, (_, i) => `o${i + 1}`).filter((id) => !['o12', 'o10', 'o2'].includes(id))];
    const all = exportItems({ outputs: completed, order });
    const items = exportItems({ outputs: completed, order }, new Set(['o2', 'o12', 'o10']));
    const share = vi.fn(async (_data: { files: File[] }) => {});
    vi.stubGlobal('navigator', { share, canShare: () => true });
    const sending = platform.shareImages(all);
    expect(share).toHaveBeenCalledOnce(); // Called synchronously inside the tap.
    await sending;
    const fullFiles = share.mock.calls[0][0].files;
    expect(fullFiles.map((file) => file.name)).toEqual(Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(4, '0')}_GameShot_test.png`));
    expect(await Promise.all(fullFiles.map(async (file) => new Uint8Array(await file.arrayBuffer())[0]))).toEqual([12, 10, 2, 1, 3, 4, 5, 6, 7, 8, 9, 11]);
    await platform.shareImages(items);
    const files = share.mock.calls[1][0].files;
    expect(files.map((file) => file.name)).toEqual(['0001_GameShot_test.png', '0002_GameShot_test.png', '0003_GameShot_test.png']);
    expect(await Promise.all(files.map(async (file) => [...new Uint8Array(await file.arrayBuffer())]))).toEqual([[12], [10], [2]]);
  });
  it('keeps ZIP names, receipt and bytes fixed while the caller changes during delayed fetch', async () => {
    vi.useFakeTimers();
    const { blobs } = downloadHarness();
    const first = deferred<Response>();
    const fetch = vi.fn(async (uri: string) => uri === 'blob:3' ? first.promise : new Response(new Uint8Array([Number(uri.split(':')[1])])));
    vi.stubGlobal('fetch', fetch);
    const platform = await import('../lib/crop/platform.web');
    const items = mutable(exportItems({ outputs: [output(1), output(2), output(3)], order: ['o3', 'o1', 'o2'] }));
    const pending = platform.shareOutputs(items, 'test');
    items[0].name = 'wrong.png'; items[1].output.uri = 'blob:999'; items.reverse();
    first.resolve(new Response(new Uint8Array([3])));
    await pending;
    const files = unzipSync(new Uint8Array(await blobs[0].arrayBuffer()));
    expect(Object.keys(files).filter((name) => name.startsWith('cropped/'))).toEqual(['cropped/0001_GameShot_test.png', 'cropped/0002_GameShot_test.png', 'cropped/0003_GameShot_test.png']);
    expect([...files['cropped/0001_GameShot_test.png']]).toEqual([3]);
    expect([...files['cropped/0002_GameShot_test.png']]).toEqual([1]);
    const receipt = JSON.parse(new TextDecoder().decode(files['order.json']));
    expect(receipt.images.map((image: { importPosition: number }) => image.importPosition)).toEqual([3, 1, 2]);
    expect(fetch.mock.calls.map(([uri]) => uri)).toEqual(['blob:3', 'blob:1', 'blob:2']);
  });
  it('single selected-image download uses exactly its batch-selected filename and unchanged bytes', async () => {
    vi.useFakeTimers();
    const { blobs, links } = downloadHarness();
    const platform = await import('../lib/crop/platform.web');
    const outputs = [output(1), output(2), output(3)];
    platform.registerOutputFile(outputs[2], new Blob([new Uint8Array([3])], { type: 'image/png' }));
    const items = exportItems({ outputs }, new Set(['o3']));
    await platform.shareSingle(items[0].output, items[0].name);
    expect(links[0].download).toBe('0001_GameShot_test.png');
    expect([...new Uint8Array(await blobs[0].arrayBuffer())]).toEqual([3]);
  });
  it('captures folder order before the picker returns, preserving names through delayed writes', async () => {
    const selected = mutable(exportItems({ outputs: [output(1), output(2), output(3)], order: ['o3', 'o1', 'o2'] }, new Set(['o3', 'o2'])));
    const picker = deferred<unknown>();
    const written: [string, number][] = [];
    const folder = { async getFileHandle(name: string) { return { async createWritable() { return { async write(blob: Blob) { written.push([name, new Uint8Array(await blob.arrayBuffer())[0]]); }, async close() {} }; } }; } };
    const root = { name: 'Files', async getDirectoryHandle(_name: string, opts?: { create?: boolean }) { if (!opts?.create) throw Object.assign(new Error('missing'), { name: 'NotFoundError' }); return folder; } };
    const showDirectoryPicker = vi.fn(() => picker.promise);
    vi.stubGlobal('window', { isSecureContext: true, showDirectoryPicker });
    vi.stubGlobal('fetch', async (uri: string) => new Response(new Uint8Array([Number(uri.split(':')[1])])));
    const platform = await import('../lib/crop/platform.web');
    const pending = platform.saveToFolder(selected);
    expect(showDirectoryPicker).toHaveBeenCalledOnce();
    selected[0].name = 'changed.png'; selected[1].output.uri = 'blob:999'; selected.reverse();
    picker.resolve(root);
    expect((await pending)?.saved).toBe(2);
    expect(written).toEqual([['0001_GameShot_test.png', 3], ['0002_GameShot_test.png', 2]]);
  });
});
