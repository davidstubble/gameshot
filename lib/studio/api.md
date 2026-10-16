# GameShot LABS studio API

All image transformation is **local-first**. `transformImage` processes one source per call; callers own sequencing, progress, cancellation, and Pro authorization.

## `rules.ts`

```ts
export type ImageLabSettings = {
  width: number; height: number;
  fit: 'inside' | 'contain' | 'cover';
  allowUpscale: boolean;
  format: 'png' | 'jpeg'; quality: number;
  background: 'white' | 'black';
};
export const DEFAULT_IMAGE_SETTINGS: ImageLabSettings;
export function validateImageSettings(settings: ImageLabSettings): string | null;
export function imagePlacement(
  sourceDimensions: { width: number; height: number },
  settings: ImageLabSettings,
): { width: number; height: number; drawWidth: number; drawHeight: number; x: number; y: number };

export type LayoutSettings = {
  paper: 'a4' | 'letter'; orientation: 'portrait' | 'landscape';
  columns: number; captions: boolean; title: string;
};
export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings;
export function validateLayoutSettings(settings: LayoutSettings): string | null;
```

`inside` returns an aspect-preserving output no larger than the requested box. `contain` returns the exact box with background padding. `cover` returns the exact box and intentionally crops edges. Image targets are 1–8192 px per side and at most 32 MP; sources may be at most 100 MP. There is no enhancement/upscaling beyond the explicit `allowUpscale` setting.

## Platform adapter (`images.ts` / `images.web.ts` / `images.native.ts`)

```ts
export const supportsContain: boolean;
export const supportsContactSheet: boolean;
export async function transformImage(
  source: SourceImage, settings: ImageLabSettings,
  batchId: string, index: number, total: number,
): Promise<CropOutput>;
export async function sourceAsJpeg(
  source: SourceImage, maxWidth: number, maxHeight: number,
): Promise<{ bytes: Uint8Array; width: number; height: number }>;
export async function makeContactSheet(
  sources: SourceImage[], settings: LayoutSettings, batchId: string,
): Promise<CropOutput>;
```

Output IDs are stable from the batch and sequence; outputs are fresh copies and retain `sourceName`, `sequence` (`index + 1`), true encoded byte size, dimensions, and extension. Web contact sheets are supported. Native adapters report unsupported contact sheets (rather than claiming success) and can reject `contain` if no true padded-canvas operation is available. Its `sourceAsJpeg` also rejects an alpha-bearing PNG rather than falsely claiming it was flattened against white. Native output uses cache `GameShot/cropped`, never Documents.

## `pdf.ts`

```ts
export async function createLayoutPdf(
  images: { name: string; bytes: Uint8Array; width: number; height: number }[],
  settings: LayoutSettings,
): Promise<Uint8Array>;
export async function downloadPdf(bytes: Uint8Array, name: string): Promise<void>;
```

The PDF is an ordered, paginated contact-sheet PDF. It accepts at most 100 images and at most 128 MiB prepared image bytes. Contact sheets accept at most 12 sources. User-provided titles/captions are bounded and sanitized for PDF safe Unicode fallback; embedded image bytes are never modified.
