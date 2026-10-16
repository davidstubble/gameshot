import { getCropRect, outputName } from './geometry';
import type { BatchResult, CropOutput, CropRect, CropSettings, SourceImage } from './types';

export type CropExecutor = (source: SourceImage, rect: CropRect, settings: CropSettings, name: string, batchId: string) => Promise<CropOutput>;
export async function runBatch(
  images: SourceImage[], settings: CropSettings, crop: CropExecutor,
  cancelled: () => boolean, progress: (done: number, current: string) => void,
): Promise<BatchResult> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result: BatchResult = { id, createdAt: Date.now(), outputs: [], errors: [], total: images.length, cancelled: false };
  for (let i = 0; i < images.length; i++) {
    if (cancelled()) { result.cancelled = true; break; }
    const source = images[i];
    progress(i, source.name);
    try {
      const rect = getCropRect(source, settings);
      const output = await crop(source, rect, settings, outputName(source.name, settings.format, i, images.length), id);
      if (output.width !== rect.width || output.height !== rect.height) throw new Error('Output dimensions did not match the crop.');
      result.outputs.push({ ...output, sequence: i + 1 });
    } catch (error) {
      result.errors.push({ name: source.name, message: error instanceof Error ? error.message : 'Image processing failed.' });
    }
    progress(i + 1, source.name);
    // Yield between images so progress and cancellation controls can update.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return result;
}
