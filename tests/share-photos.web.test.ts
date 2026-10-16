import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CropOutput, CropRect, CropSettings, SourceImage } from '../lib/crop/types';
import { exportItems } from '../lib/crop/export-tools';
const items = (outputs: CropOutput[], order?: string[]) => exportItems({ outputs, order });

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function croppedBatch() {
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '' }),
    toBlob: (done: (blob: Blob) => void, type: string) => done(new Blob([new Uint8Array([1, 2, 3])], { type })) };
  class FakeImage { naturalWidth = 200; naturalHeight = 200; onload?: () => void; set src(_v: string) { queueMicrotask(() => this.onload?.()); } }
  vi.stubGlobal('window', { Image: FakeImage });
  vi.stubGlobal('document', { createElement: () => canvas });
  let n = 0;
  vi.stubGlobal('URL', { createObjectURL: () => `blob:out-${++n}`, revokeObjectURL: vi.fn() });
  const platform = await import('../lib/crop/platform.web');
  const source: SourceImage = { id: 's', uri: 'blob:src', name: 'shot.png', size: 3, width: 200, height: 200 };
  const rect: CropRect = { x: 0, y: 0, width: 100, height: 100 };
  const settings = { format: 'png' } as CropSettings;
  const outputs = [];
  for (const seq of [1, 2, 3]) {
    const out = await platform.cropImage(source, rect, settings, `000${seq}_shot_cropped.png`, 'batch');
    outputs.push({ ...out, sequence: seq });
  }
  return { platform, outputs };
}

describe('phone share sheet export', () => {
  it('shares every crop as an image file in posting order, even if given out of order', async () => {
    const { platform, outputs } = await croppedBatch();
    const share = vi.fn(async (_data: { files: File[] }) => undefined);
    vi.stubGlobal('navigator', { share, canShare: () => true });
    expect(platform.canShareImages(items(outputs))).toBe(true);
    await expect(platform.shareImages(items([outputs[2], outputs[0], outputs[1]]))).resolves.toBe(true);
    const files = share.mock.calls[0][0].files;
    expect(files.map((file) => file.name)).toEqual(['0001_GameShot_batch.png', '0002_GameShot_batch.png', '0003_GameShot_batch.png']);
    expect(files.every((file) => file.type === 'image/png')).toBe(true);
  });
  it('shares a custom order as renumbered files without changing the stored copies', async () => {
    const { platform, outputs } = await croppedBatch();
    const share = vi.fn(async (_data: { files: File[] }) => undefined);
    vi.stubGlobal('navigator', { share, canShare: () => true });
    const custom = items(outputs, [outputs[2].id, outputs[0].id, outputs[1].id]);
    await expect(platform.shareImages(custom)).resolves.toBe(true);
    expect(share.mock.calls[0][0].files.map((file) => file.name)).toEqual(['0001_GameShot_batch.png', '0002_GameShot_batch.png', '0003_GameShot_batch.png']);
    expect(custom.map((item) => item.output.name)).toEqual(['0003_shot_cropped.png', '0001_shot_cropped.png', '0002_shot_cropped.png']);
  });
  it('treats closing the share sheet as a cancel, not an error', async () => {
    const { platform, outputs } = await croppedBatch();
    const abort = Object.assign(new Error('closed'), { name: 'AbortError' });
    vi.stubGlobal('navigator', { share: async () => { throw abort; }, canShare: () => true });
    await expect(platform.shareImages(items(outputs))).resolves.toBe(false);
  });
  it('hides the share action where the browser cannot share files', async () => {
    const { platform, outputs } = await croppedBatch();
    vi.stubGlobal('navigator', {});
    expect(platform.canShareImages(items(outputs))).toBe(false);
    await expect(platform.shareImages(items(outputs))).rejects.toThrow('Download them instead');
  });
});
