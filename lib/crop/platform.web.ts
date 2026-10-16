import { orderReceipt, transferChecklist, type TransferTarget } from './transfer';
import { zipSync, strToU8 } from 'fflate';
import { exportFolderName, itemsBytes, snapshotExportItems, type ExportItem } from './export-tools';
import type { CropOutput, CropRect, CropSettings, PickResult, SourceImage } from './types';

export { TIKTOK_PHOTO_LIMIT } from './export-tools';
export const supportsGallery = false;
/** Browser crops are in-memory object URLs that disappear with the tab; nothing to clear on launch. */
export function clearSessionFiles(): void {}
const MAX_ZIP_BYTES = 128 * 1024 * 1024;
/** Finished crops kept as File objects so the share sheet opens inside the tap (Safari requires it). */
const outputFiles = new Map<string, File>();

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unsupported or damaged image. Try PNG, JPEG or WebP.'));
    image.src = uri;
  });
}

export async function pickImages(_fromFiles = false): Promise<PickResult> {
  const files = await new Promise<File[]>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
    input.style.display = 'none'; document.body.appendChild(input);
    const finish = (items: File[]) => { input.remove(); resolve(items); };
    input.onchange = () => finish(Array.from(input.files ?? []));
    input.oncancel = () => finish([]);
    input.click();
  });
  const result: PickResult = { images: [], errors: [] };
  for (const file of files) {
    const uri = URL.createObjectURL(file);
    try {
      const image = await loadImage(uri);
      if (image.naturalWidth * image.naturalHeight > 100_000_000) throw new Error('Image exceeds 100 megapixels. Choose a smaller source.');
      result.images.push({ id: `${Date.now()}-${Math.random()}`, uri, name: file.name, size: file.size, width: image.naturalWidth, height: image.naturalHeight });
    } catch (error) {
      URL.revokeObjectURL(uri);
      result.errors.push({ name: file.name, message: error instanceof Error ? error.message : 'Could not open image.' });
    }
  }
  return result;
}

const mimeOf = (format: CropOutput['format']) => (format === 'png' ? 'image/png' : 'image/jpeg');

export async function cropImage(source: SourceImage, rect: CropRect, settings: CropSettings, name: string, batchId: string): Promise<CropOutput> {
  const image = await loadImage(source.uri);
  const canvas = document.createElement('canvas');
  canvas.width = rect.width; canvas.height = rect.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser does not support image processing.');
  if (settings.format === 'jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, rect.width, rect.height); }
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (b) => b ? resolve(b) : reject(new Error('Unable to encode this image. It may be too large.')),
    mimeOf(settings.format), 0.95,
  ));
  canvas.width = 0; canvas.height = 0;
  const id = `${batchId}-${name}`;
  outputFiles.set(id, new File([blob], name, { type: blob.type || mimeOf(settings.format) }));
  return { id, sourceName: source.name, name, uri: URL.createObjectURL(blob), size: blob.size, width: rect.width, height: rect.height, format: settings.format, batchId };
}

/** Makes a reopened library image shareable inside a tap, like a freshly cropped one. */
export function registerOutputFile(output: Pick<CropOutput, 'id' | 'name' | 'format'>, blob: Blob) {
  outputFiles.set(output.id, new File([blob], output.name, { type: blob.type || mimeOf(output.format) }));
}

export async function outputBlob(output: CropOutput): Promise<Blob> {
  const file = outputFiles.get(output.id);
  if (file) return file;
  const response = await fetch(output.uri);
  if (!response.ok && response.status !== 0) throw new Error(`${output.name} is no longer available in this session.`);
  return response.blob();
}

/** Reuse matching files; otherwise copy bytes under the canonical selected-export filename. */
function shareableFiles(items: readonly ExportItem[]): File[] | null {
  const files = items.map(({ output, name }) => {
    const file = outputFiles.get(output.id);
    if (!file) return null;
    return file.name === name ? file : new File([file], name, { type: file.type || mimeOf(output.format) });
  });
  return files.length && files.every((file): file is File => !!file) ? files : null;
}

/** True when this browser can send these images to the system share sheet (phones, and some desktops). */
export function canShareImages(items: readonly ExportItem[]): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  const files = shareableFiles(items);
  try { return !!files && navigator.canShare({ files }); } catch { return false; }
}

/** Opens the share sheet with the given images in posting order. Returns false if the person closed the sheet. */
export async function shareImages(items: readonly ExportItem[]): Promise<boolean> {
  items = snapshotExportItems(items);
  const files = shareableFiles(items);
  if (!files || !canShareImages(items)) throw new Error('This browser cannot share images directly. Download them instead.');
  try {
    // No await before share(): the browser only opens the sheet during the tap.
    await navigator.share({ files, title: 'GameShot crops' });
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return false;
    throw new Error('Sharing did not finish. Try again, or download the images instead.');
  }
}

function download(blob: Blob, name: string) {
  const uri = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = uri; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(uri), 60_000);
}

/** Downloads one ZIP whose cropped/ entries follow the given posting order. Returns the ZIP filename. */
export async function shareOutputs(items: readonly ExportItem[], batchId: string): Promise<string> {
  items = snapshotExportItems(items);
  if (!items.length) throw new Error('Select at least one image to export.');
  if (itemsBytes(items) > MAX_ZIP_BYTES) throw new Error('This selection is too large for one ZIP in memory (128 MB). Select fewer images or save to a folder.');
  const files: Record<string, Uint8Array> = {};
  for (const item of items) files[`cropped/${item.name}`] = new Uint8Array(await (await outputBlob(item.output)).arrayBuffer());
  files['ORDER.txt'] = strToU8(transferChecklist(items));
  files['order.json'] = strToU8(JSON.stringify(orderReceipt(items), null, 2));
  const zipped = zipSync(files, { level: 0 });
  const name = `GameShot-${batchId}.zip`;
  download(new Blob([new Uint8Array(zipped)], { type: 'application/zip' }), name);
  return name;
}

export async function shareSingle(output: CropOutput, name = output.name): Promise<void> {
  output = Object.freeze({ ...output });
  download(await outputBlob(output), name);
}

export async function saveToGallery(_items: readonly ExportItem[]): Promise<{ saved: number; errors: string[] }> {
  throw new Error('Gallery saving is available in the phone app. Download your copies instead.');
}

type DirectoryHandle = {
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }> }>;
};
type DirectoryPicker = (options?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: string }) => Promise<DirectoryHandle>;
const directoryPicker = (): DirectoryPicker | null => {
  if (typeof window === 'undefined' || !window.isSecureContext) return null;
  const picker = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
  return typeof picker === 'function' ? picker.bind(window) : null;
};

/** Chromium desktop browsers can write separate images into a folder the person chooses. */
export function supportsFolderSave(): boolean { return !!directoryPicker(); }

export type FolderSaveResult = { folder: string; saved: number; errors: string[] };

/**
 * Writes separate images into a new GameShot subfolder of the chosen folder. Existing files are never
 * opened or overwritten. Returns null if the person closed the folder picker.
 */
export async function saveToFolder(items: readonly ExportItem[], date = new Date()): Promise<FolderSaveResult | null> {
  items = snapshotExportItems(items);
  const picker = directoryPicker();
  if (!picker) throw new Error('This browser cannot save into a folder. Use Download ZIP instead.');
  if (!items.length) throw new Error('Select at least one image to export.');
  let root: DirectoryHandle;
  try {
    // Must be the first await so the browser treats the picker as part of the tap.
    root = await picker({ id: 'gameshot-exports', mode: 'readwrite', startIn: 'pictures' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return null;
    if (error instanceof Error && error.name === 'SecurityError') throw new Error('The browser blocked folder access in this view. Open GameShot in its own tab, or use Download ZIP.');
    throw new Error('Folder access was not granted. Use Download ZIP instead.');
  }
  const base = exportFolderName(date);
  let folderName = base, folder: DirectoryHandle | null = null;
  for (let attempt = 1; attempt <= 50 && !folder; attempt++) {
    folderName = attempt === 1 ? base : `${base}-${attempt}`;
    try { await root.getDirectoryHandle(folderName, { create: false }); }
    catch (error) {
      if (error instanceof Error && error.name === 'NotFoundError') folder = await root.getDirectoryHandle(folderName, { create: true });
      else if (error instanceof Error && error.name === 'TypeMismatchError') continue;
      else throw new Error('GameShot could not create a folder there. Choose another folder, or use Download ZIP.');
    }
  }
  if (!folder) throw new Error('Too many GameShot folders with this time already exist there. Choose another folder.');
  const result: FolderSaveResult = { folder: `${root.name}/${folderName}`, saved: 0, errors: [] };
  for (const item of items) {
    try {
      const handle = await folder.getFileHandle(item.name, { create: true });
      const writable = await handle.createWritable();
      try { await writable.write(await outputBlob(item.output)); await writable.close(); }
      catch (error) { await writable.abort?.().catch(() => undefined); throw error; }
      result.saved++;
    } catch (error) {
      result.errors.push(`${item.name}: ${error instanceof Error && error.name === 'QuotaExceededError' ? 'Not enough disk space.' : 'Could not be written.'}`);
    }
  }
  return result;
}

export function releaseSource(source: SourceImage) { if (source.uri.startsWith('blob:')) URL.revokeObjectURL(source.uri); }

/** A separate checklist, never mixed into image share sheets. */
export async function shareTransferPlan(items: readonly ExportItem[], target: TransferTarget): Promise<string> {
  items = snapshotExportItems(items);
  if (!items.length) throw new Error('Select at least one image for the checklist.');
  const name = `GameShot-${target}-ORDER.txt`;
  download(new Blob([transferChecklist(items, target)], { type: 'text/plain;charset=utf-8' }), name);
  return name;
}
