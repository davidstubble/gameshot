import type { CropRect, CropSettings, Dimensions, OutputFormat } from './types';

export const PRO_PRESET: CropRect = { x: 1488, y: 570, width: 3350, height: 1700 };
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function integer(value: string, label: string, minimum: number): number {
  if (!/^\d+$/.test(value.trim())) throw new Error(`${label} must be a whole number.`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < minimum) {
    throw new Error(`${label} must be ${minimum === 0 ? 'zero or greater' : 'greater than zero'}.`);
  }
  return n;
}

export function readRatio(settings: CropSettings): number {
  const valid = (s: string) => /^\d+(?:\.\d+)?$/.test(s.trim());
  const w = Number(settings.ratioWidth), h = Number(settings.ratioHeight);
  if (!valid(settings.ratioWidth) || !valid(settings.ratioHeight) || w <= 0 || h <= 0 || !Number.isFinite(w / h)) {
    throw new Error('Enter two positive numbers for the aspect ratio.');
  }
  if (w / h < 0.01 || w / h > 100) throw new Error('Use a ratio between 1:100 and 100:1.');
  return w / h;
}

export function validateSettings(settings: CropSettings): string | null {
  try {
    if (settings.mode === 'pixels') {
      integer(settings.width, 'Width', 1);
      integer(settings.height, 'Height', 1);
      if (!settings.centered) { integer(settings.x, 'X offset', 0); integer(settings.y, 'Y offset', 0); }
    } else if (settings.mode === 'ratio') readRatio(settings);
    return null;
  } catch (error) { return error instanceof Error ? error.message : 'Invalid crop settings.'; }
}

export function getCropRect(source: Dimensions, settings: CropSettings): CropRect {
  if (!Number.isSafeInteger(source.width) || !Number.isSafeInteger(source.height) || source.width <= 0 || source.height <= 0) {
    throw new Error('This image has no readable pixel dimensions.');
  }
  const validation = validateSettings(settings);
  if (validation) throw new Error(validation);
  let rect: CropRect;
  if (settings.mode === 'preset') rect = { ...PRO_PRESET };
  else if (settings.mode === 'pixels') {
    const width = integer(settings.width, 'Width', 1), height = integer(settings.height, 'Height', 1);
    rect = {
      width, height,
      x: settings.centered ? Math.floor((source.width - width) / 2) : integer(settings.x, 'X offset', 0),
      y: settings.centered ? Math.floor((source.height - height) / 2) : integer(settings.y, 'Y offset', 0),
    };
  } else {
    const ratio = readRatio(settings);
    const scale = clamp(Number.isFinite(settings.scale) ? settings.scale : 1, 0.1, 1);
    const width = Math.max(1, Math.floor(Math.min(source.width, source.height * ratio) * scale));
    const height = Math.max(1, Math.min(source.height, Math.round(width / ratio)));
    rect = {
      width, height,
      x: Math.round((source.width - width) * clamp(settings.anchorX, 0, 1)),
      y: Math.round((source.height - height) * clamp(settings.anchorY, 0, 1)),
    };
  }
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > source.width || rect.y + rect.height > source.height) {
    const minWidth = Math.max(rect.width, rect.x + rect.width);
    const minHeight = Math.max(rect.height, rect.y + rect.height);
    throw new Error(`Crop doesn't fit ${source.width} × ${source.height}px. Needs at least ${minWidth} × ${minHeight}px at these offsets.`);
  }
  return rect;
}

export function tryCropRect(source: Dimensions, settings: CropSettings): { rect: CropRect | null; error: string | null } {
  try { return { rect: getCropRect(source, settings), error: null }; }
  catch (error) { return { rect: null, error: error instanceof Error ? error.message : 'Could not calculate crop.' }; }
}

export function dragCrop(source: Dimensions, settings: CropSettings, rect: CropRect, dx: number, dy: number): Partial<CropSettings> {
  if (settings.mode === 'preset') return {};
  const x = Math.round(clamp(rect.x + dx, 0, source.width - rect.width));
  const y = Math.round(clamp(rect.y + dy, 0, source.height - rect.height));
  if (settings.mode === 'pixels') return { x: String(x), y: String(y), centered: false };
  return {
    anchorX: source.width === rect.width ? 0.5 : x / (source.width - rect.width),
    anchorY: source.height === rect.height ? 0.5 : y / (source.height - rect.height),
  };
}

export function outputName(original: string, format: OutputFormat, index: number, total = index + 1): string {
  const base = original.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}._-]/gu, '_').replace(/^\.+/, '').slice(0, 100) || 'image';
  const digits = Math.max(4, String(Math.max(total, index + 1)).length);
  const sequence = String(index + 1).padStart(digits, '0');
  return `${sequence}_${base}_cropped.${format === 'jpeg' ? 'jpg' : 'png'}`;
}

export function formatBytes(n: number): string {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
