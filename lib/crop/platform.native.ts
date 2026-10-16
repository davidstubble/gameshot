import { orderReceipt, transferChecklist, type TransferTarget } from './transfer';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { zipSync, strToU8 } from 'fflate';
import { itemsBytes, snapshotExportItems, type ExportItem } from './export-tools';
import type { CropOutput, CropRect, CropSettings, PickResult, SourceImage } from './types';

export { TIKTOK_PHOTO_LIMIT } from './export-tools';
export const supportsGallery = true;
const MAX_ZIP_BYTES = 128 * 1024 * 1024;
/** Session crops live in cache storage; only "Keep on this device" copies them into durable storage. */
const sessionFolder = (batchId: string) => new Directory(Paths.cache, 'GameShot', 'session', batchId);
const exportFolder = (kind: 'gallery' | 'share') => new Directory(Paths.cache, 'GameShot-export', kind);
let sessionCleared = false;

function removeIfPresent(directory: Directory) {
  try { if (directory.exists) directory.delete(); } catch { /* Cache cleanup is best effort; the OS may also purge it. */ }
}
/** Clears session crops left by a previous app run (once per launch, before anything is cropped). */
export function clearSessionFiles(): void {
  if (sessionCleared) return;
  sessionCleared = true;
  removeIfPresent(new Directory(Paths.cache, 'GameShot', 'session'));
  removeIfPresent(new Directory(Paths.cache, 'GameShot-export'));
}
const basename = (uri: string) => decodeURIComponent(uri.split('/').pop() ?? '');
/** Returns a file carrying the export name, copying into a temporary folder only when the name differs. */
async function namedCopy(item: ExportItem, folder: Directory): Promise<string> {
  if (basename(item.output.uri) === item.name) return item.output.uri;
  folder.create({ intermediates: true, idempotent: true });
  const target = new File(folder, item.name);
  if (target.exists) target.delete();
  await new File(item.output.uri).copy(target);
  return target.uri;
}
/** Browser share-sheet export is web-only; the native app saves to the gallery instead. */
export function canShareImages(_items: readonly ExportItem[]): boolean { return false; }
export async function shareImages(_items: readonly ExportItem[]): Promise<boolean> {
  throw new Error('Use Save new copies to gallery in the phone app.');
}
/** Folder saving is a desktop-browser feature; phones use the gallery or the share sheet. */
export function supportsFolderSave(): boolean { return false; }
export type FolderSaveResult = { folder: string; saved: number; errors: string[] };
export async function saveToFolder(_items: readonly ExportItem[], _date?: Date): Promise<FolderSaveResult | null> {
  throw new Error('Use Save to gallery or Share ZIP in the phone app.');
}

export async function pickImages(fromFiles = false): Promise<PickResult> {
  let assets: { uri: string; name: string; size?: number }[] = [];
  if (fromFiles) {
    const picked = await DocumentPicker.getDocumentAsync({ type: 'image/*', multiple: true, copyToCacheDirectory: true });
    if (picked.canceled) return { images: [], errors: [] };
    assets = picked.assets.map((a) => ({ uri: a.uri, name: a.name, size: a.size }));
  } else {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, allowsEditing: false,
      quality: 1, orderedSelection: true, selectionLimit: 0,
    });
    if (picked.canceled) return { images: [], errors: [] };
    assets = picked.assets.map((a, i) => ({ uri: a.uri, name: a.fileName ?? `screenshot-${i + 1}.png`, size: a.fileSize }));
  }
  const result: PickResult = { images: [], errors: [] };
  // Decode sequentially to establish the dimensions actually used by the native crop engine.
  for (const asset of assets) {
    const context = ImageManipulator.manipulate(asset.uri);
    try {
      const image = await context.renderAsync();
      try {
        if (image.width * image.height > 100_000_000) throw new Error('Image exceeds 100 megapixels. Choose a smaller source.');
        result.images.push({ ...asset, id: `${Date.now()}-${Math.random()}`, width: image.width, height: image.height });
      } finally { image.release(); }
    } catch (error) {
      result.errors.push({ name: asset.name, message: error instanceof Error ? error.message : 'Unsupported or damaged image.' });
    } finally { context.release(); }
  }
  return result;
}

export async function cropImage(source: SourceImage, rect: CropRect, settings: CropSettings, name: string, batchId: string): Promise<CropOutput> {
  const directory = sessionFolder(batchId);
  directory.create({ intermediates: true, idempotent: true });
  const context = ImageManipulator.manipulate(source.uri);
  try {
    context.crop({ originX: rect.x, originY: rect.y, width: rect.width, height: rect.height });
    const image = await context.renderAsync();
    try {
      if (image.width !== rect.width || image.height !== rect.height) throw new Error('Crop engine returned unexpected dimensions.');
      const encoded = await image.saveAsync({ format: settings.format === 'png' ? SaveFormat.PNG : SaveFormat.JPEG, compress: 0.95 });
      const temporary = new File(encoded.uri), target = new File(directory, name);
      await temporary.copy(target);
      // Only the image manipulator's newly-created temporary file is removed, never the source.
      temporary.delete();
      return { id: `${batchId}-${name}`, sourceName: source.name, name, uri: target.uri, width: encoded.width, height: encoded.height, size: target.size, format: settings.format, batchId };
    } finally { image.release(); }
  } finally { context.release(); }
}

export async function shareOutputs(items: readonly ExportItem[], batchId: string): Promise<string> {
  items = snapshotExportItems(items);
  if (!items.length) throw new Error('Select at least one image to export.');
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device. Save new copies to the gallery instead.');
  if (itemsBytes(items) > MAX_ZIP_BYTES) throw new Error('This selection exceeds the 128 MB ZIP limit. Select fewer images or save copies to the gallery.');
  const files: Record<string, Uint8Array> = {};
  for (const item of items) files[`cropped/${item.name}`] = await new File(item.output.uri).bytes();
  files['ORDER.txt'] = strToU8(transferChecklist(items));
  files['order.json'] = strToU8(JSON.stringify(orderReceipt(items), null, 2));
  const directory = new Directory(Paths.cache, 'GameShot-sharing');
  directory.create({ idempotent: true, intermediates: true });
  const name = `GameShot-${batchId}.zip`;
  const target = new File(directory, name);
  target.create({ overwrite: true });
  target.write(zipSync(files, { level: 0 }));
  await Sharing.shareAsync(target.uri, { mimeType: 'application/zip', UTI: 'public.zip-archive', dialogTitle: 'Save or share cropped copies' });
  return name;
}

export async function shareSingle(output: CropOutput, name = output.name): Promise<void> {
  output = Object.freeze({ ...output });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
  // The previous shared copy is cleared now rather than after the sheet, which may still be reading it.
  const folder = exportFolder('share');
  removeIfPresent(folder);
  const uri = await namedCopy({ output, name, position: 0 }, folder);
  await Sharing.shareAsync(uri, { mimeType: output.format === 'png' ? 'image/png' : 'image/jpeg', dialogTitle: name });
}

/**
 * Saves the given items to the gallery last-to-first, as a best effort for newest-first pickers.
 * This does not control Photos date sorting or a destination app. Retries keep assigned names.
 */
export async function saveToGallery(items: readonly ExportItem[]): Promise<{ saved: number; errors: string[] }> {
  items = snapshotExportItems(items);
  const permission = await requestPermissionsAsync(true, ['photo']);
  if (!permission.granted) throw new Error('Photo permission was not granted. Your private crop copies are still safe; use Share ZIP or enable permission in Settings.');
  const result = { saved: 0, errors: [] as string[] };
  const folder = exportFolder('gallery');
  removeIfPresent(folder);
  try {
    for (const item of [...items].reverse()) {
      try { await Asset.create(await namedCopy(item, folder)); result.saved++; }
      catch (error) { result.errors.push(`${item.name}: ${error instanceof Error ? error.message : 'Could not save copy.'}`); }
    }
  } finally { removeIfPresent(folder); } // The gallery keeps its own copies.
  return result;
}
export function releaseSource(_source: SourceImage) { /* Picked local source copies remain system-cache-managed. */ }

/** Share a text checklist separately from photos. The sheet decides the final destination. */
export async function shareTransferPlan(items: readonly ExportItem[], target: TransferTarget): Promise<string> {
  items = snapshotExportItems(items);
  if (!items.length) throw new Error('Select at least one image for the checklist.');
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device. Use the order receipt in Share ZIP instead.');
  const directory = new Directory(Paths.cache, 'GameShot-sharing');
  directory.create({ intermediates: true, idempotent: true });
  const name = `GameShot-${target}-ORDER.txt`;
  const file = new File(directory, name);
  file.create({ overwrite: true });
  file.write(transferChecklist(items, target));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: 'Save transfer checklist' });
  return name;
}
