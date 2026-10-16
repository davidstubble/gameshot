import type { Dimensions } from '../crop/types';

export const MAX_TARGET_DIMENSION = 8192;
export const MAX_TARGET_PIXELS = 32_000_000;
export const MAX_SOURCE_PIXELS = 100_000_000;
export const MAX_CONTACT_SHEET_SOURCES = 12;
export const MAX_PDF_IMAGES = 100;
export const MAX_PDF_PREPARED_BYTES = 128 * 1024 * 1024;
export const MAX_LAYOUT_TITLE_LENGTH = 120;
export const MAX_LAYOUT_COLUMNS = 4;

export type ImageLabSettings = {
  width: number;
  height: number;
  fit: 'inside' | 'contain' | 'cover';
  allowUpscale: boolean;
  format: 'png' | 'jpeg';
  quality: number;
  background: 'white' | 'black';
};

export const DEFAULT_IMAGE_SETTINGS: ImageLabSettings = {
  width: 1920,
  height: 1080,
  fit: 'inside',
  allowUpscale: false,
  format: 'jpeg',
  quality: 0.95,
  background: 'white',
};

export type LayoutSettings = {
  paper: 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
  columns: number;
  captions: boolean;
  title: string;
};

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  paper: 'a4',
  orientation: 'portrait',
  columns: 2,
  captions: true,
  title: '',
};

export type ImagePlacement = {
  /** Encoded output width. `inside` deliberately has no padding. */
  width: number;
  /** Encoded output height. `inside` deliberately has no padding. */
  height: number;
  /** Dimensions of the source pixels drawn into the output. */
  drawWidth: number;
  drawHeight: number;
  /** Top-left draw offset. Negative values are intentional for `cover`. */
  x: number;
  y: number;
};

export type PaperSize = { width: number; height: number };
export type ContactSheetGeometry = {
  page: PaperSize;
  margin: number;
  titleHeight: number;
  captionHeight: number;
  gutter: number;
  rows: number;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  imageHeight: number;
};

const hasWholeNumber = (value: number) => Number.isSafeInteger(value) && value > 0;

/** Returns a clear user-facing message rather than coercing invalid size or encoder values. */
export function validateImageSettings(settings: ImageLabSettings): string | null {
  if (!settings || typeof settings !== 'object') return 'Image settings are required.';
  if (!hasWholeNumber(settings.width) || !hasWholeNumber(settings.height)) return 'Width and height must be whole numbers greater than zero.';
  if (settings.width > MAX_TARGET_DIMENSION || settings.height > MAX_TARGET_DIMENSION) return `Target dimensions cannot exceed ${MAX_TARGET_DIMENSION} px on either side.`;
  if (settings.width * settings.height > MAX_TARGET_PIXELS) return 'Target output cannot exceed 32 megapixels.';
  if (settings.fit !== 'inside' && settings.fit !== 'contain' && settings.fit !== 'cover') return 'Choose inside, contain, or cover fit.';
  if (typeof settings.allowUpscale !== 'boolean') return 'Choose whether enlargement is allowed.';
  if (settings.format !== 'png' && settings.format !== 'jpeg') return 'Choose PNG or JPEG output.';
  if (typeof settings.quality !== 'number' || !Number.isFinite(settings.quality) || settings.quality < 0.95 || settings.quality > 1) return 'JPEG quality must be between 95% and 100% so small text stays readable.';
  if (settings.background !== 'white' && settings.background !== 'black') return 'Choose a white or black background.';
  return null;
}

/** Throws only for impossible source/target combinations; callers may isolate this per source. */
export function assertSourceDimensions(source: Dimensions): void {
  if (!source || !hasWholeNumber(source.width) || !hasWholeNumber(source.height)) throw new Error('This image has no readable pixel dimensions.');
  if (source.width * source.height > MAX_SOURCE_PIXELS) throw new Error('Image exceeds 100 megapixels. Choose a smaller source.');
}

const roundedInside = (sourceWidth: number, sourceHeight: number, scale: number, targetWidth: number, targetHeight: number) => ({
  width: Math.min(targetWidth, Math.max(1, Math.floor(sourceWidth * scale))),
  height: Math.min(targetHeight, Math.max(1, Math.floor(sourceHeight * scale))),
});

/**
 * Calculates the only placement used by web and native transforms. `cover` is the explicit
 * edge-loss option; `inside` preserves pixels without padding, and `contain` adds background.
 */
export function imagePlacement(sourceDimensions: Dimensions, settings: ImageLabSettings): ImagePlacement {
  const problem = validateImageSettings(settings);
  if (problem) throw new Error(problem);
  assertSourceDimensions(sourceDimensions);

  const { width: sourceWidth, height: sourceHeight } = sourceDimensions;
  const { width: targetWidth, height: targetHeight } = settings;
  const containScale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);

  if (settings.fit === 'inside') {
    const scale = settings.allowUpscale ? containScale : Math.min(1, containScale);
    const output = roundedInside(sourceWidth, sourceHeight, scale, targetWidth, targetHeight);
    return { width: output.width, height: output.height, drawWidth: output.width, drawHeight: output.height, x: 0, y: 0 };
  }

  if (settings.fit === 'contain') {
    const scale = settings.allowUpscale ? containScale : Math.min(1, containScale);
    const draw = roundedInside(sourceWidth, sourceHeight, scale, targetWidth, targetHeight);
    return {
      width: targetWidth, height: targetHeight, drawWidth: draw.width, drawHeight: draw.height,
      x: Math.floor((targetWidth - draw.width) / 2), y: Math.floor((targetHeight - draw.height) / 2),
    };
  }

  const coverScale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  if (!settings.allowUpscale && coverScale > 1) {
    throw new Error('Cover would need enlargement for this source. Enable upscaling or use inside/contain.');
  }
  const drawWidth = Math.max(targetWidth, Math.ceil(sourceWidth * coverScale));
  const drawHeight = Math.max(targetHeight, Math.ceil(sourceHeight * coverScale));
  return {
    width: targetWidth, height: targetHeight, drawWidth, drawHeight,
    x: Math.floor((targetWidth - drawWidth) / 2), y: Math.floor((targetHeight - drawHeight) / 2),
  };
}

export function validateLayoutSettings(settings: LayoutSettings): string | null {
  if (!settings || typeof settings !== 'object') return 'Layout settings are required.';
  if (settings.paper !== 'a4' && settings.paper !== 'letter') return 'Choose A4 or Letter paper.';
  if (settings.orientation !== 'portrait' && settings.orientation !== 'landscape') return 'Choose portrait or landscape orientation.';
  if (!Number.isSafeInteger(settings.columns) || settings.columns < 1 || settings.columns > MAX_LAYOUT_COLUMNS) return `Columns must be a whole number from 1 to ${MAX_LAYOUT_COLUMNS}.`;
  if (typeof settings.captions !== 'boolean') return 'Choose whether captions are included.';
  if (typeof settings.title !== 'string') return 'Title must be text.';
  if ([...settings.title].length > MAX_LAYOUT_TITLE_LENGTH) return `Title must be ${MAX_LAYOUT_TITLE_LENGTH} characters or fewer.`;
  if (/\p{Cc}/u.test(settings.title.replace(/[\n\r\t]/g, ''))) return 'Title cannot contain control characters.';
  return null;
}

/** PDF points; A4 uses its ISO 216 dimensions and Letter uses US points. */
export function layoutPaperSize(settings: LayoutSettings): PaperSize {
  const problem = validateLayoutSettings(settings);
  if (problem) throw new Error(problem);
  const base = settings.paper === 'a4' ? { width: 595.28, height: 841.89 } : { width: 612, height: 792 };
  return settings.orientation === 'portrait' ? base : { width: base.height, height: base.width };
}

/** A single contact-sheet canvas fits every selected image. PDF callers pass at most three rows per page. */
export function contactSheetGeometry(settings: LayoutSettings, itemCount: number): ContactSheetGeometry {
  const problem = validateLayoutSettings(settings);
  if (problem) throw new Error(problem);
  if (!Number.isSafeInteger(itemCount) || itemCount < 1 || itemCount > MAX_CONTACT_SHEET_SOURCES) {
    throw new Error(`A contact sheet needs 1 to ${MAX_CONTACT_SHEET_SOURCES} images.`);
  }
  const page = layoutPaperSize(settings);
  const margin = 36;
  const gutter = 12;
  const titleHeight = settings.title.trim() ? 32 : 0;
  const captionHeight = settings.captions ? 20 : 0;
  const rows = Math.ceil(itemCount / settings.columns);
  const cellWidth = (page.width - margin * 2 - gutter * (settings.columns - 1)) / settings.columns;
  const cellHeight = (page.height - margin * 2 - titleHeight - gutter * (rows - 1)) / rows;
  const imageHeight = Math.max(1, cellHeight - captionHeight);
  return { page, margin, titleHeight, captionHeight, gutter, rows, columns: settings.columns, cellWidth, cellHeight, imageHeight };
}

/** Deterministic local-copy filename; the source extension is never reused for a different encoding. */
export function studioOutputName(original: string, format: ImageLabSettings['format'], index: number, total: number): string {
  const safeIndex = Number.isSafeInteger(index) && index >= 0 ? index : 0;
  const safeTotal = Number.isSafeInteger(total) && total > 0 ? total : safeIndex + 1;
  const base = original.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}._-]/gu, '_').replace(/^\.+/, '').slice(0, 100) || 'image';
  const digits = Math.max(4, String(Math.max(safeTotal, safeIndex + 1)).length);
  return `${String(safeIndex + 1).padStart(digits, '0')}_${base}_lab.${format === 'jpeg' ? 'jpg' : 'png'}`;
}
