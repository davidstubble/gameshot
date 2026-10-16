import { afterEach, describe, expect, it, vi } from 'vitest';
import { unzipSync } from 'fflate';
import { shareOutputs } from '../lib/crop/platform.web';
import { exportItems } from '../lib/crop/export-tools';
import type { CropOutput } from '../lib/crop/types';

const output = (sequence: number): CropOutput => ({
  id: String(sequence), sequence, sourceName: `source-${sequence}.png`,
  name: `000${sequence}_source-${sequence}_cropped.png`,
  uri: `blob:crop-${sequence}`, width: 100, height: 100,
  size: 3, format: 'png', batchId: 'batch',
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('browser ZIP posting order', () => {
  it('downloads a real ZIP with entries in received order, not caller-array order', async () => {
    vi.useFakeTimers();
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:zip');
    const fetchOutput = vi.fn(async (_uri: string) => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal('document', { body: { appendChild: vi.fn() }, createElement: () => link });
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    vi.stubGlobal('fetch', fetchOutput);
    await expect(shareOutputs(exportItems({ outputs: [output(3), output(1), output(2)] }), 'batch')).resolves.toBe('GameShot-batch.zip');
    expect(fetchOutput.mock.calls.map(([uri]) => uri)).toEqual(['blob:crop-1', 'blob:crop-2', 'blob:crop-3']);
    const blob = createObjectURL.mock.calls[0][0];
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(files).filter((name) => name.startsWith('cropped/'))).toEqual([
      'cropped/0001_GameShot_batch.png',
      'cropped/0002_GameShot_batch.png',
      'cropped/0003_GameShot_batch.png',
    ]);
    const receipt = JSON.parse(new TextDecoder().decode(files['order.json']));
    expect(receipt.images.map((image: { exportName: string }) => `cropped/${image.exportName}`)).toEqual(Object.keys(files).filter((name) => name.startsWith('cropped/')));
    expect(new TextDecoder().decode(files['ORDER.txt'])).toContain('POSTING ORDER');
    expect(link.download).toBe('GameShot-batch.zip');
    expect(link.click).toHaveBeenCalledOnce();
  });
});
