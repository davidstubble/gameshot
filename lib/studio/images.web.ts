import type { CropOutput, SourceImage } from '../crop/types';
import { registerOutputFile } from '../crop/platform.web';
import {
  assertSourceDimensions,
  contactSheetGeometry,
  imagePlacement,
  MAX_CONTACT_SHEET_SOURCES,
  studioOutputName,
  type ImageLabSettings,
  type LayoutSettings,
  validateLayoutSettings,
} from './rules';

// Compatibility re-export for the studio UI; the implementation remains in the shared PDF module.
export { downloadPdf } from './pdf';

export const supportsContain = true;
export const supportsContactSheet = true;

function loadImage(uri: string): Promise<HTMLImageElement> {
  if (/^https?:\/\//i.test(uri)) return Promise.reject(new Error('Only local source images can be processed.'));
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unsupported or damaged image. Try PNG, JPEG or WebP.'));
    image.src = uri;
  });
}

function encode(canvas: HTMLCanvasElement, format: ImageLabSettings['format'], quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Unable to encode this image. It may be too large.')),
    format === 'png' ? 'image/png' : 'image/jpeg',
    quality,
  ));
}

function outputId(batchId: string, index: number): string {
  if (!batchId) throw new Error('A batch id is required for a generated copy.');
  if (!Number.isSafeInteger(index) || index < 0) throw new Error('Image sequence must be a zero-based whole number.');
  return `${batchId}-lab-${index + 1}`;
}

function paintBackground(context: CanvasRenderingContext2D, width: number, height: number, background: ImageLabSettings['background']) {
  context.fillStyle = background === 'black' ? '#000000' : '#ffffff';
  context.fillRect(0, 0, width, height);
}

/** Processes exactly one local source and registers its actual File synchronously for Safari sharing. */
export async function transformImage(source: SourceImage, settings: ImageLabSettings, batchId: string, index: number, total: number): Promise<CropOutput> {
  const image = await loadImage(source.uri);
  const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
  assertSourceDimensions(dimensions);
  const placement = imagePlacement(dimensions, settings);
  const canvas = document.createElement('canvas');
  canvas.width = placement.width;
  canvas.height = placement.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser does not support image processing.');
  // JPEG has no alpha; contain/cover use the selected background as actual padded/flattened pixels.
  if (settings.format === 'jpeg' || settings.fit !== 'inside') paintBackground(context, placement.width, placement.height, settings.background);
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height, placement.x, placement.y, placement.drawWidth, placement.drawHeight);
  const blob = await encode(canvas, settings.format, settings.quality);
  canvas.width = 0;
  canvas.height = 0;
  const name = studioOutputName(source.name, settings.format, index, total);
  const output: CropOutput = {
    id: outputId(batchId, index), sourceName: source.name, name, uri: URL.createObjectURL(blob), size: blob.size,
    width: placement.width, height: placement.height, format: settings.format, batchId, sequence: index + 1,
  };
  // Keeps the real File ready before the calling UI's share-tap; Safari cannot recreate it asynchronously then.
  registerOutputFile(output, blob);
  return output;
}

/** Re-encodes a local source to JPEG for PDF prep, flattening alpha against white without any network request. */
export async function sourceAsJpeg(source: SourceImage, maxWidth: number, maxHeight: number): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  if (!Number.isSafeInteger(maxWidth) || !Number.isSafeInteger(maxHeight) || maxWidth < 1 || maxHeight < 1) throw new Error('JPEG preparation dimensions must be whole numbers greater than zero.');
  const image = await loadImage(source.uri);
  const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
  assertSourceDimensions(dimensions);
  const placement = imagePlacement(dimensions, { width: maxWidth, height: maxHeight, fit: 'inside', allowUpscale: false, format: 'jpeg', quality: 0.95, background: 'white' });
  const canvas = document.createElement('canvas');
  canvas.width = placement.width;
  canvas.height = placement.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser does not support image processing.');
  paintBackground(context, placement.width, placement.height, 'white');
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height, 0, 0, placement.width, placement.height);
  const blob = await encode(canvas, 'jpeg', 0.95);
  canvas.width = 0;
  canvas.height = 0;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: placement.width, height: placement.height };
}

function displayText(value: string, maximum = 70): string {
  const characters = [...value.replace(/[\r\n\t]+/g, ' ').trim()];
  return characters.length > maximum ? `${characters.slice(0, Math.max(0, maximum - 1)).join('')}…` : characters.join('');
}

/** Builds one reproducible local raster contact sheet in the caller's source order. */
export async function makeContactSheet(sources: SourceImage[], settings: LayoutSettings, batchId: string): Promise<CropOutput> {
  const layoutError = validateLayoutSettings(settings);
  if (layoutError) throw new Error(layoutError);
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > MAX_CONTACT_SHEET_SOURCES) throw new Error(`Contact sheets support 1 to ${MAX_CONTACT_SHEET_SOURCES} images.`);
  if (!batchId) throw new Error('A batch id is required for a contact sheet.');
  const geometry = contactSheetGeometry(settings, sources.length);
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(geometry.page.width * scale);
  canvas.height = Math.round(geometry.page.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser does not support contact sheet creation.');
  context.scale(scale, scale);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, geometry.page.width, geometry.page.height);
  context.textBaseline = 'alphabetic';
  if (geometry.titleHeight) {
    context.fillStyle = '#1f2937';
    context.font = '600 16px system-ui, sans-serif';
    context.fillText(displayText(settings.title, 100), geometry.margin, geometry.margin + 17);
  }

  for (let index = 0; index < sources.length; index++) {
    const source = sources[index];
    const column = index % geometry.columns;
    const row = Math.floor(index / geometry.columns);
    const x = geometry.margin + column * (geometry.cellWidth + geometry.gutter);
    const y = geometry.margin + geometry.titleHeight + row * (geometry.cellHeight + geometry.gutter);
    const imageY = y;
    context.fillStyle = '#f4f4f5';
    context.fillRect(x, imageY, geometry.cellWidth, geometry.imageHeight);
    context.strokeStyle = '#c4c4c7';
    context.lineWidth = 0.5;
    context.strokeRect(x, imageY, geometry.cellWidth, geometry.imageHeight);
    try {
      const image = await loadImage(source.uri);
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      assertSourceDimensions(dimensions);
      const ratio = Math.min((geometry.cellWidth - 8) / dimensions.width, (geometry.imageHeight - 8) / dimensions.height);
      const drawWidth = Math.max(1, dimensions.width * ratio);
      const drawHeight = Math.max(1, dimensions.height * ratio);
      context.drawImage(image, x + (geometry.cellWidth - drawWidth) / 2, imageY + (geometry.imageHeight - drawHeight) / 2, drawWidth, drawHeight);
    } catch {
      context.fillStyle = '#6b7280';
      context.font = '10px system-ui, sans-serif';
      context.fillText('Could not load image', x + 6, imageY + geometry.imageHeight / 2);
    }
    if (geometry.captionHeight) {
      context.fillStyle = '#4b5563';
      context.font = '8px system-ui, sans-serif';
      context.fillText(displayText(source.name), x, y + geometry.imageHeight + 12);
    }
  }

  const blob = await encode(canvas, 'png', 1);
  canvas.width = 0;
  canvas.height = 0;
  const output: CropOutput = {
    id: `${batchId}-contact-sheet`, sourceName: `${sources.length} selected images`, name: 'GameShot-contact-sheet.png',
    uri: URL.createObjectURL(blob), size: blob.size, width: Math.round(geometry.page.width * scale), height: Math.round(geometry.page.height * scale),
    format: 'png', batchId,
  };
  registerOutputFile(output, blob);
  return output;
}
