import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { contactSheetGeometry, MAX_PDF_IMAGES, MAX_PDF_PREPARED_BYTES, type LayoutSettings, validateLayoutSettings } from './rules';
import { downloadPdf as downloadPdfForPlatform } from './pdf.download';

export type PdfLayoutImage = {
  name: string;
  bytes: Uint8Array;
  width: number;
  height: number;
};

const IMAGE_GUTTER = 8;
const PAGE_BACKGROUND = rgb(1, 1, 1);
const CELL_BACKGROUND = rgb(0.965, 0.965, 0.965);
const BORDER = rgb(0.78, 0.78, 0.78);
const INK = rgb(0.12, 0.12, 0.12);
const MUTED = rgb(0.36, 0.36, 0.36);

/**
 * Standard PDF fonts use WinAnsi, so retain ASCII directly, decompose accents where possible,
 * and display other code points as visible `U+…` tokens rather than allowing font encoding to throw.
 */
export function safePdfText(value: string, maxInputCharacters = 120, maxOutputCharacters = 240): string {
  const source = typeof value === 'string' ? value : '';
  let output = '';
  let seen = 0;
  for (const original of source) {
    if (seen++ >= maxInputCharacters) break;
    if (original === '\n' || original === '\r' || original === '\t') { output += ' '; continue; }
    const normalized = original.normalize('NFKD');
    let handled = false;
    for (const character of normalized) {
      const code = character.codePointAt(0) ?? 0;
      if (code >= 0x300 && code <= 0x36f) continue; // combining mark after a decomposed Latin glyph
      if (code >= 0x20 && code <= 0x7e) { output += character; handled = true; }
    }
    if (!handled) output += `[U+${(original.codePointAt(0) ?? 0).toString(16).toUpperCase()}]`;
    if (output.length >= maxOutputCharacters) break;
  }
  output = output.replace(/\s+/g, ' ').trim();
  return output.length > maxOutputCharacters ? `${output.slice(0, Math.max(0, maxOutputCharacters - 3))}...` : output;
}

function clippedText(font: PDFFont, value: string, size: number, maxWidth: number): string {
  const text = safePdfText(value);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && font.widthOfTextAtSize(`${text.slice(0, end)}...`, size) > maxWidth) end--;
  return end ? `${text.slice(0, end)}...` : '';
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function validDimensions(image: PdfLayoutImage): boolean {
  return Number.isFinite(image.width) && Number.isFinite(image.height) && image.width > 0 && image.height > 0;
}

function drawUnavailableCell(page: ReturnType<PDFDocument['addPage']>, font: PDFFont, x: number, y: number, width: number, height: number, name: string) {
  const label = clippedText(font, `Could not include ${name || 'image'}`, 9, Math.max(1, width - 12));
  page.drawText(label || 'Could not include image', { x: x + 6, y: y + Math.max(6, height / 2 - 4), size: 9, font, color: MUTED });
}

/**
 * Creates a portable, ordered PDF without modifying caller-owned image byte arrays. Bad encoded
 * images occupy their original cell with an explanatory label, so one damaged input does not erase
 * the remainder of a sheet.
 */
export async function createLayoutPdf(images: PdfLayoutImage[], settings: LayoutSettings): Promise<Uint8Array> {
  const layoutError = validateLayoutSettings(settings);
  if (layoutError) throw new Error(layoutError);
  if (!Array.isArray(images) || images.length === 0) throw new Error('Select at least one prepared image for the PDF.');
  if (images.length > MAX_PDF_IMAGES) throw new Error(`PDF layouts support at most ${MAX_PDF_IMAGES} images.`);
  const bytes = images.reduce((total, image) => total + (image?.bytes instanceof Uint8Array ? image.bytes.byteLength : 0), 0);
  if (bytes > MAX_PDF_PREPARED_BYTES) throw new Error('Prepared images exceed the 128 MB PDF limit. Select fewer or smaller images.');

  const document = await PDFDocument.create();
  document.setTitle(safePdfText(settings.title || 'GameShot layout', 120, 160));
  document.setCreator('GameShot LABS');
  document.setProducer('GameShot LABS local layout engine');
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const perPage = settings.columns * 3;

  for (let start = 0; start < images.length; start += perPage) {
    const sheetImages = images.slice(start, start + perPage);
    const geometry = contactSheetGeometry(settings, sheetImages.length);
    const page = document.addPage([geometry.page.width, geometry.page.height]);
    page.drawRectangle({ x: 0, y: 0, width: geometry.page.width, height: geometry.page.height, color: PAGE_BACKGROUND });
    if (geometry.titleHeight) {
      const title = clippedText(bold, settings.title, 16, geometry.page.width - geometry.margin * 2);
      if (title) page.drawText(title, { x: geometry.margin, y: geometry.page.height - geometry.margin - 17, size: 16, font: bold, color: INK });
    }

    for (let index = 0; index < sheetImages.length; index++) {
      const source = sheetImages[index];
      const column = index % geometry.columns;
      const row = Math.floor(index / geometry.columns);
      const x = geometry.margin + column * (geometry.cellWidth + geometry.gutter);
      const top = geometry.page.height - geometry.margin - geometry.titleHeight - row * (geometry.cellHeight + geometry.gutter);
      const y = top - geometry.cellHeight;
      const imageY = y + geometry.captionHeight;
      const imageHeight = geometry.imageHeight;
      page.drawRectangle({ x, y: imageY, width: geometry.cellWidth, height: imageHeight, color: CELL_BACKGROUND, borderColor: BORDER, borderWidth: 0.5 });

      try {
        if (!source || !(source.bytes instanceof Uint8Array) || !validDimensions(source)) throw new Error('Invalid image metadata');
        const encoded = new Uint8Array(source.bytes); // Explicit copy: never mutate a caller-owned view/buffer.
        const embedded = isPng(encoded) ? await document.embedPng(encoded) : isJpeg(encoded) ? await document.embedJpg(encoded) : null;
        if (!embedded) throw new Error('Only PNG and JPEG prepared images are supported');
        const scale = Math.min((geometry.cellWidth - IMAGE_GUTTER * 2) / source.width, (imageHeight - IMAGE_GUTTER * 2) / source.height);
        const drawWidth = Math.max(1, source.width * scale);
        const drawHeight = Math.max(1, source.height * scale);
        page.drawImage(embedded, {
          x: x + (geometry.cellWidth - drawWidth) / 2,
          y: imageY + (imageHeight - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        });
      } catch {
        drawUnavailableCell(page, font, x, imageY, geometry.cellWidth, imageHeight, source?.name ?? 'image');
      }

      if (geometry.captionHeight) {
        const caption = clippedText(font, source?.name ?? '', 8, geometry.cellWidth);
        if (caption) page.drawText(caption, { x, y: y + 6, size: 8, font, color: MUTED });
      }
    }
  }

  return new Uint8Array(await document.save());
}

/** Platform adapter: browser Blob download or a native cache copy opened in the system share sheet. */
export async function downloadPdf(bytes: Uint8Array, name: string): Promise<void> {
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength) throw new Error('The PDF has no bytes to download.');
  await downloadPdfForPlatform(bytes, name);
}
