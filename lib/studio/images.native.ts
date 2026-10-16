import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import type { CropOutput, SourceImage } from '../crop/types';
import {
  assertSourceDimensions,
  imagePlacement,
  MAX_CONTACT_SHEET_SOURCES,
  studioOutputName,
  type ImageLabSettings,
  type LayoutSettings,
} from './rules';

// Compatibility re-export for the studio UI; the implementation remains in the shared PDF module.
export { downloadPdf } from './pdf';

/** Expo's installed native ImageManipulator has no native `extent` (padded canvas) operation. */
export const supportsContain = false;
/** A truthful capability flag: native has no local canvas compositor for sheets/title/captions. */
export const supportsContactSheet = false;

const croppedFolder = (batchId: string) => new Directory(Paths.cache, 'GameShot', 'cropped', batchId);

function outputId(batchId: string, index: number): string {
  if (!batchId) throw new Error('A batch id is required for a generated copy.');
  if (!Number.isSafeInteger(index) || index < 0) throw new Error('Image sequence must be a zero-based whole number.');
  return `${batchId}-lab-${index + 1}`;
}

function looksTransparentPng(bytes: Uint8Array): boolean {
  if (bytes.length < 26 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return false;
  // PNG IHDR colour type 4/6 contains alpha. Indexed/grayscale can declare tRNS later.
  if (bytes[25] === 4 || bytes[25] === 6) return true;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    if (type === 'tRNS') return true;
    if (!Number.isSafeInteger(length) || offset + 12 + length > bytes.length) break;
    offset += 12 + length;
  }
  return false;
}

async function hasTransparentPng(source: SourceImage): Promise<boolean> {
  if (!/\.png(?:$|[?#])/i.test(source.name) && !/\.png(?:$|[?#])/i.test(source.uri)) return false;
  try { return looksTransparentPng(await new File(source.uri).bytes()); }
  catch { return false; } // Let ImageManipulator report unreadable local files precisely.
}

/** Processes one source at a time and never modifies the source URI. */
export async function transformImage(source: SourceImage, settings: ImageLabSettings, batchId: string, index: number, total: number): Promise<CropOutput> {
  assertSourceDimensions(source);
  if (settings.fit === 'contain') throw new Error('Contain needs a padded canvas, which is unavailable in this native image engine. Use inside, cover, or the web app.');
  const placement = imagePlacement(source, settings);
  const directory = croppedFolder(batchId);
  directory.create({ intermediates: true, idempotent: true });
  const name = studioOutputName(source.name, settings.format, index, total);
  const target = new File(directory, name);
  if (target.exists) throw new Error(`A generated copy named ${name} already exists in this batch; originals were not changed.`);

  const context = ImageManipulator.manipulate(source.uri);
  try {
    context.resize({ width: placement.drawWidth, height: placement.drawHeight });
    if (settings.fit === 'cover') context.crop({ originX: -placement.x, originY: -placement.y, width: placement.width, height: placement.height });
    const image = await context.renderAsync();
    try {
      if (image.width !== placement.width || image.height !== placement.height) throw new Error('Image engine returned unexpected output dimensions.');
      const encoded = await image.saveAsync({ format: settings.format === 'png' ? SaveFormat.PNG : SaveFormat.JPEG, compress: settings.quality });
      const temporary = new File(encoded.uri);
      try { await temporary.copy(target); }
      finally { try { temporary.delete(); } catch { /* The system may already have released its temporary copy. */ } }
      return {
        id: outputId(batchId, index), sourceName: source.name, name, uri: target.uri, size: target.size,
        width: encoded.width, height: encoded.height, format: settings.format, batchId, sequence: index + 1,
      };
    } finally { image.release(); }
  } finally { context.release(); }
}

/**
 * Prepares a local JPEG for layouts. Transparent PNG is rejected rather than silently rendering
 * an unknown background: this runtime has no local canvas compositor for safe flattening.
 */
export async function sourceAsJpeg(source: SourceImage, maxWidth: number, maxHeight: number): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  assertSourceDimensions(source);
  if (await hasTransparentPng(source)) throw new Error('This native runtime cannot safely flatten a transparent PNG for PDF preparation. Use a pre-flattened image or prepare the PDF in the web app.');
  const placement = imagePlacement(source, { width: maxWidth, height: maxHeight, fit: 'inside', allowUpscale: false, format: 'jpeg', quality: 0.95, background: 'white' });
  const context = ImageManipulator.manipulate(source.uri);
  try {
    context.resize({ width: placement.width, height: placement.height });
    const image = await context.renderAsync();
    try {
      const encoded = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
      const temporary = new File(encoded.uri);
      try {
        return { bytes: await temporary.bytes(), width: encoded.width, height: encoded.height };
      } finally { try { temporary.delete(); } catch { /* Generated system cache cleanup is best effort. */ } }
    } finally { image.release(); }
  } finally { context.release(); }
}

/** Native does not claim a fake rendered sheet when it has no true canvas compositor. */
export async function makeContactSheet(sources: SourceImage[], _settings: LayoutSettings, _batchId: string): Promise<CropOutput> {
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > MAX_CONTACT_SHEET_SOURCES) throw new Error(`Contact sheets support 1 to ${MAX_CONTACT_SHEET_SOURCES} images.`);
  throw new Error('Contact sheets are unavailable in the native image adapter. Create the local PDF layout, or use the web app for a PNG contact sheet.');
}
