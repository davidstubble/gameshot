import { describe, expect, it, vi, beforeEach } from 'vitest';
import { unzipSync } from 'fflate';
import { runBatch, type CropExecutor } from '../lib/crop/batch';
import { outputName } from '../lib/crop/geometry';
import { gallerySaveOrder, inPostingOrder } from '../lib/crop/order';
import { exportItems } from '../lib/crop/export-tools';
import { DEFAULT_SETTINGS, type CropOutput, type SourceImage } from '../lib/crop/types';

const native = vi.hoisted(() => ({
  share: vi.fn(async () => {}),
  available: vi.fn(async () => true),
  permission: vi.fn(async () => ({ granted: true })),
  createAsset: vi.fn(async (_uri: string) => ({})),
  pick: vi.fn(),
  writes: [] as Uint8Array[],
  copies: [] as [string, string][],
  deletedDirs: [] as string[],
}));
vi.mock('expo-sharing', () => ({ shareAsync: native.share, isAvailableAsync: native.available }));
vi.mock('expo-media-library', () => ({ Asset: { create: native.createAsset }, requestPermissionsAsync: native.permission }));
vi.mock('expo-image-picker', () => ({ launchImageLibraryAsync: native.pick }));
vi.mock('expo-document-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({
  SaveFormat: { PNG: 'png', JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      renderAsync: async () => ({ width: 5120, height: 2880, release() {} }),
      release() {},
    }),
  },
}));
vi.mock('expo-file-system', () => ({
  Paths: { document: 'file:///documents', cache: 'file:///cache' },
  Directory: class {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = parts.map((p) => typeof p === 'string' ? p : p.uri).join('/'); }
    create() {}
    get exists() { return true; }
    delete() { native.deletedDirs.push(this.uri); }
  },
  File: class {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = parts.map((p) => typeof p === 'string' ? p : p.uri).join('/'); }
    async bytes() { return new Uint8Array([1, 2, 3]); }
    get exists() { return false; }
    create() {}
    delete() {}
    async copy(target: { uri: string }) { native.copies.push([this.uri, target.uri]); }
    write(data: Uint8Array) { native.writes.push(data); }
  },
}));
import { pickImages, saveToGallery, shareOutputs, shareSingle } from '../lib/crop/platform.native';

const source = (name: string, width = 5120): SourceImage => ({ id: name, name, uri: `file:///${name}`, width, height: 2880 });
const crop: CropExecutor = async (image, rect, settings, name, batchId) => ({
  id: image.id, sourceName: image.name, name, uri: `file:///cropped/${name}`,
  width: rect.width, height: rect.height, size: 3, format: settings.format, batchId,
});
const output = (sequence: number): CropOutput => ({
  id: `image-${sequence}`, sourceName: `image-${sequence}.png`,
  name: outputName(`image-${sequence}.png`, 'png', sequence - 1, 12),
  uri: `file:///cache/GameShot/session/batch/${outputName(`image-${sequence}.png`, 'png', sequence - 1, 12)}`, width: 100, height: 100,
  size: 3, format: 'png', batchId: 'batch', sequence,
});

beforeEach(() => {
  vi.clearAllMocks();
  native.writes.length = 0;
  native.copies.length = 0;
  native.deletedDirs.length = 0;
  native.permission.mockResolvedValue({ granted: true });
  native.available.mockResolvedValue(true);
  native.createAsset.mockResolvedValue({});
});

describe('posting order from the received queue', () => {
  it('keeps import order even when original filenames sort differently', async () => {
    const images = [source('z-final.jpg'), source('a-start.png'), source('middle.png')];
    const result = await runBatch(images, DEFAULT_SETTINGS, crop, () => false, () => {});
    expect(result.outputs.map((o) => o.sourceName)).toEqual(images.map((i) => i.name));
    expect(result.outputs.map((o) => o.sequence)).toEqual([1, 2, 3]);
    expect(result.outputs.map((o) => o.name)).toEqual([
      '0001_z-final_cropped.png', '0002_a-start_cropped.png', '0003_middle_cropped.png',
    ]);
    expect([...result.outputs.map((o) => o.name)].sort()).toEqual(result.outputs.map((o) => o.name));
  });
  it('keeps the original positions when a source is skipped', async () => {
    const result = await runBatch([source('z.png'), source('bad.png', 1920), source('a.png')], DEFAULT_SETTINGS, crop, () => false, () => {});
    expect(result.outputs.map((o) => o.sequence)).toEqual([1, 3]);
    expect(result.outputs.map((o) => o.name)).toEqual(['0001_z_cropped.png', '0003_a_cropped.png']);
    expect(result.errors.map((e) => e.name)).toEqual(['bad.png']);
  });
  it('sorts names correctly across 9, 99, 999 and 9999 with one width per batch', () => {
    const names = [0, 8, 9, 98, 99, 998, 999, 9998, 9999].map((i) => outputName('same.jpg', 'jpeg', i, 10000));
    expect(names).toEqual([...names].sort());
    expect(names[0]).toBe('00001_same_cropped.jpg');
    expect(names.at(-1)).toBe('10000_same_cropped.jpg');
    expect(new Set(names).size).toBe(names.length);
  });
  it('reorders sequence metadata without mutating caller arrays', () => {
    const shuffled = [output(3), output(1), output(2)];
    expect(inPostingOrder(shuffled).map((o) => o.sequence)).toEqual([1, 2, 3]);
    expect(gallerySaveOrder(shuffled).map((o) => o.sequence)).toEqual([3, 2, 1]);
    expect(shuffled.map((o) => o.sequence)).toEqual([3, 1, 2]);
  });
  it('preserves legacy session order when sequence metadata is absent', () => {
    const legacy = [output(3), output(1)].map(({ sequence: _sequence, ...o }) => o);
    expect(inPostingOrder(legacy).map((o) => o.id)).toEqual(['image-3', 'image-1']);
  });
});

describe('native ordered export adapter (SDK boundaries mocked)', () => {
  it('preserves picker-returned order and requests ordered selection', async () => {
    native.pick.mockResolvedValue({ canceled: false, assets: [
      { uri: 'file:///z.png', fileName: 'z.png' },
      { uri: 'file:///a.png', fileName: 'a.png' },
      { uri: 'file:///m.png', fileName: 'm.png' },
    ] });
    const picked = await pickImages();
    expect(picked.images.map((i) => i.name)).toEqual(['z.png', 'a.png', 'm.png']);
    expect(native.pick).toHaveBeenCalledWith(expect.objectContaining({ orderedSelection: true }));
  });
  it('writes real ZIP entries in posting order even from a shuffled output array', async () => {
    await shareOutputs(exportItems({ outputs: [output(3), output(1), output(2)] }), 'batch');
    const files = unzipSync(native.writes[0]);
    expect(Object.keys(files).filter((name) => name.startsWith('cropped/'))).toEqual([
      'cropped/0001_GameShot_batch.png',
      'cropped/0002_GameShot_batch.png',
      'cropped/0003_GameShot_batch.png',
    ]);
    const receipt = JSON.parse(new TextDecoder().decode(files['order.json']));
    expect(receipt.images.map((image: { exportName: string }) => `cropped/${image.exportName}`)).toEqual(Object.keys(files).filter((name) => name.startsWith('cropped/')));
    expect(new TextDecoder().decode(files['ORDER.txt'])).toContain('POSTING ORDER');
    expect(files['cropped/0001_GameShot_batch.png']).toEqual(new Uint8Array([1, 2, 3]));
    expect(native.share).toHaveBeenCalledTimes(1);
  });
  it('awaits numbered gallery writes last-to-first without a display-order guarantee', async () => {
    const shuffled = [output(2), output(1), output(3)];
    expect(await saveToGallery(exportItems({ outputs: shuffled }))).toEqual({ saved: 3, errors: [] });
    expect(native.createAsset.mock.calls.map(([uri]) => uri)).toEqual([
      'file:///cache/GameShot-export/gallery/0003_GameShot_batch.png', 'file:///cache/GameShot-export/gallery/0002_GameShot_batch.png', 'file:///cache/GameShot-export/gallery/0001_GameShot_batch.png',
    ]);
    expect(shuffled.map((o) => o.sequence)).toEqual([2, 1, 3]);
    expect(native.copies).toHaveLength(3); // Renamed copies, never image re-encoding.
  });
  it('continues saving after a gallery failure without changing remaining order', async () => {
    native.createAsset.mockRejectedValueOnce(new Error('Could not save'));
    const result = await saveToGallery(exportItems({ outputs: [output(1), output(2), output(3)] }));
    expect(result.saved).toBe(2);
    expect(result.errors).toEqual(['0003_GameShot_batch.png: Could not save']);
    expect(native.createAsset.mock.calls.map(([uri]) => uri)).toEqual([
      'file:///cache/GameShot-export/gallery/0003_GameShot_batch.png', 'file:///cache/GameShot-export/gallery/0002_GameShot_batch.png', 'file:///cache/GameShot-export/gallery/0001_GameShot_batch.png',
    ]);
  });
  it('applies a chosen order and selection to ZIP names and gallery save order', async () => {
    const batch = { outputs: [output(1), output(2), output(3)], order: ['image-3', 'image-1', 'image-2'] };
    const items = exportItems(batch, new Set(['image-3', 'image-2']));
    await shareOutputs(items, 'batch');
    expect(Object.keys(unzipSync(native.writes[0])).filter((name) => name.startsWith('cropped/'))).toEqual(['cropped/0001_GameShot_batch.png', 'cropped/0002_GameShot_batch.png']);
    await saveToGallery(items);
    const G = 'file:///cache/GameShot-export/gallery/';
    // Each temporary copy carries its selected-export name, in awaited reverse write order.
    expect(native.createAsset.mock.calls.map(([uri]) => uri)).toEqual([`${G}0002_GameShot_batch.png`, `${G}0001_GameShot_batch.png`]);
    expect(native.copies).toEqual([
      ['file:///cache/GameShot/session/batch/0002_image-2_cropped.png', `${G}0002_GameShot_batch.png`],
      ['file:///cache/GameShot/session/batch/0003_image-3_cropped.png', `${G}0001_GameShot_batch.png`],
    ]);
    expect(native.deletedDirs).toContain('file:///cache/GameShot-export/gallery'); // temporary copies cleaned up
  });
  it('does not write gallery copies when permission is denied', async () => {
    native.permission.mockResolvedValue({ granted: false });
    await expect(saveToGallery(exportItems({ outputs: [output(1)] }))).rejects.toThrow('Photo permission');
    expect(native.createAsset).not.toHaveBeenCalled();
  });
});


describe('native snapshot and numbered copy parity', () => {
  it('captures names and sources before a delayed permission response', async () => {
    let allow!: (value: { granted: boolean }) => void;
    native.permission.mockImplementationOnce(() => new Promise((resolve) => { allow = resolve; }));
    const items = exportItems({ outputs: [output(1), output(2), output(3)], order: ['image-3', 'image-1', 'image-2'] })
      .map((item) => ({ ...item, output: { ...item.output } }));
    const pending = saveToGallery(items);
    items[0].name = 'changed.png'; items[1].output.uri = 'file:///wrong'; items.reverse();
    allow({ granted: true });
    await pending;
    expect(native.createAsset.mock.calls.map(([uri]) => uri.split('/').at(-1))).toEqual(['0003_GameShot_batch.png', '0002_GameShot_batch.png', '0001_GameShot_batch.png']);
    expect(native.copies.map(([uri]) => uri.split('/').at(-1))).toEqual(['0002_image-2_cropped.png', '0001_image-1_cropped.png', '0003_image-3_cropped.png']);
  });
  it('awaits each of 12 writes and retries a failure under its original selected-export name', async () => {
    let active = 0, peak = 0;
    native.createAsset.mockImplementation(async (uri) => {
      active++; peak = Math.max(peak, active);
      await new Promise<void>((resolve) => setTimeout(resolve, Number(uri.slice(uri.lastIndexOf('/') + 1, uri.lastIndexOf('/') + 5)) % 3));
      active--;
      if (uri.includes('0010_')) throw new Error('save failed');
      return {};
    });
    const items = exportItems({ outputs: Array.from({ length: 12 }, (_, i) => output(i + 1)).reverse() });
    const result = await saveToGallery(items);
    expect(peak).toBe(1);
    expect(result).toEqual({ saved: 11, errors: ['0010_GameShot_batch.png: save failed'] });
    expect(native.createAsset.mock.calls.map(([uri]) => uri.split('/').at(-1))).toEqual([...items].reverse().map((item) => item.name));
    native.createAsset.mockResolvedValue({});
    const retry = items.filter((item) => result.errors.some((error) => error.startsWith(`${item.name}: `)));
    await saveToGallery(retry);
    expect(native.createAsset.mock.calls.at(-1)?.[0]).toBe('file:///cache/GameShot-export/gallery/0010_GameShot_batch.png');
  });
  it('single export uses the same selected-subset filename as ZIP and gallery without re-encoding', async () => {
    const items = exportItems({ outputs: [output(1), output(2), output(3)] }, new Set(['image-3']));
    await shareSingle(items[0].output, items[0].name);
    expect(native.share).toHaveBeenCalledWith('file:///cache/GameShot-export/share/0001_GameShot_batch.png', expect.objectContaining({ mimeType: 'image/png' }));
    expect(native.copies).toEqual([['file:///cache/GameShot/session/batch/0003_image-3_cropped.png', 'file:///cache/GameShot-export/share/0001_GameShot_batch.png']]);
  });
  it('does not copy again when the stored file already carries its canonical export name', async () => {
    const items = exportItems({ outputs: [output(1)] });
    const matching = { ...items[0], output: { ...items[0].output, uri: `file:///already/${items[0].name}` } };
    await saveToGallery([matching]);
    expect(native.copies).toHaveLength(0);
    expect(native.createAsset).toHaveBeenCalledWith(`file:///already/${matching.name}`);
  });
});
