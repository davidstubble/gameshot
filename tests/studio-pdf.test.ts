import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { createLayoutPdf, safePdfText } from '../lib/studio/pdf';
import { DEFAULT_LAYOUT_SETTINGS, MAX_PDF_IMAGES } from '../lib/studio/rules';

// A generated local 1×1 PNG fixture; no files, network, or external image services are used.
const tinyPng = () => new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
const image = (name: string, bytes = tinyPng()) => ({ name, bytes, width: 1, height: 1 });

describe('GameShot LABS PDF layouts', () => {
  it('creates an ordered, paginated one-column PDF without mutating supplied image bytes', async () => {
    const inputs = ['first.png', 'second.png', 'third.png', 'fourth.png'].map((name) => image(name));
    const before = inputs.map(({ bytes }) => bytes.slice());
    const pdf = await createLayoutPdf(inputs, { ...DEFAULT_LAYOUT_SETTINGS, columns: 1, title: 'Ordered captures' });
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(2);
    expect(inputs.map(({ bytes }) => [...bytes])).toEqual(before.map((bytes) => [...bytes]));
  });

  it('keeps a bad encoded input isolated instead of losing a whole sheet', async () => {
    const pdf = await createLayoutPdf([image('valid.png'), image('damaged.png', new Uint8Array([1, 2, 3]))], { ...DEFAULT_LAYOUT_SETTINGS, captions: true });
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });

  it('uses visible safe fallbacks for Unicode unsupported by standard PDF fonts', async () => {
    expect(safePdfText('café 中 🎮')).toContain('cafe');
    expect(safePdfText('café 中 🎮')).toContain('U+4E2D');
    await expect(createLayoutPdf([image('中.png')], { ...DEFAULT_LAYOUT_SETTINGS, title: '测试 🎮' })).resolves.toBeInstanceOf(Uint8Array);
  });

  it('enforces the documented input cap before generating pages', async () => {
    const tooMany = Array.from({ length: MAX_PDF_IMAGES + 1 }, (_, index) => image(`${index}.png`));
    await expect(createLayoutPdf(tooMany, DEFAULT_LAYOUT_SETTINGS)).rejects.toThrow('at most 100');
  });
});
