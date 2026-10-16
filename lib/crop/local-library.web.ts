import { capacityError, readStoredBatch, sortSummaries, toStoredBatch, type SavedBatchSummary, type StoredBatch } from './library-rules';
import { outputBlob, registerOutputFile } from './platform.web';
import type { BatchResult, CropOutput } from './types';

const DB_NAME = 'gameshot-library', DB_VERSION = 1, BATCHES = 'batches', IMAGES = 'images';
export const libraryLocation = 'this browser’s GameShot storage';
type BatchRecord = { id: string; batch: StoredBatch };

export function libraryAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

const request = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const done = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
  tx.onerror = () => reject(tx.error);
});

let opening: Promise<IDBDatabase> | null = null;
function database(): Promise<IDBDatabase> {
  if (!libraryAvailable()) return Promise.reject(new Error('This browser does not allow GameShot to keep images. Download them instead.'));
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(BATCHES)) db.createObjectStore(BATCHES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES);
    };
    open.onsuccess = () => { open.result.onversionchange = () => { open.result.close(); opening = null; }; resolve(open.result); };
    open.onerror = () => { opening = null; reject(new Error('This browser blocked GameShot’s device storage (private browsing or site-data settings). Download your images instead.')); };
    open.onblocked = () => { opening = null; reject(new Error('Close other GameShot tabs, then try again.')); };
  });
  return opening;
}

async function records(): Promise<StoredBatch[]> {
  const db = await database();
  const all = await request(db.transaction(BATCHES, 'readonly').objectStore(BATCHES).getAll()) as BatchRecord[];
  return all.map((record) => readStoredBatch(record?.batch)).filter((item): item is StoredBatch => !!item);
}

const imageKey = (batchId: string, outputId: string) => `${batchId}::${outputId}`;

async function storedBatch(batchId: string): Promise<StoredBatch | null> {
  const db = await database();
  const record = await request(db.transaction(BATCHES, 'readonly').objectStore(BATCHES).get(batchId)) as BatchRecord | undefined;
  return readStoredBatch(record?.batch);
}

function friendly(error: unknown, fallback: string): Error {
  if (error instanceof Error && !(error instanceof DOMException)) return error;
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'QuotaExceededError') return new Error('Your browser ran out of storage for GameShot. Remove a saved batch or free disk space, then try again.');
  return new Error(fallback);
}

export async function listSaved(): Promise<SavedBatchSummary[]> {
  return sortSummaries((await records()).map((item) => item.summary));
}

export async function keepBatch(batch: BatchResult): Promise<SavedBatchSummary> {
  try {
    const stored = toStoredBatch(batch);
    const problem = capacityError((await records()).map((item) => item.summary), stored.summary);
    if (problem) throw new Error(problem);
    const blobs = await Promise.all(batch.outputs.map((output) => outputBlob(output)));
    // Best effort: asks the browser not to evict saved batches under storage pressure.
    await navigator.storage?.persist?.().catch(() => false);
    const db = await database();
    const tx = db.transaction([BATCHES, IMAGES], 'readwrite');
    const images = tx.objectStore(IMAGES);
    batch.outputs.forEach((output, index) => images.put(blobs[index], imageKey(batch.id, output.id)));
    tx.objectStore(BATCHES).put({ id: batch.id, batch: stored } satisfies BatchRecord);
    await done(tx);
    return stored.summary;
  } catch (error) { throw friendly(error, 'GameShot could not keep this batch in browser storage. Download it instead.'); }
}

export async function updateSavedOrder(batchId: string, order: string[] | undefined): Promise<void> {
  const stored = await storedBatch(batchId);
  if (!stored) return;
  const { order: _old, ...rest } = stored;
  const db = await database();
  const tx = db.transaction(BATCHES, 'readwrite');
  tx.objectStore(BATCHES).put({ id: batchId, batch: order ? { ...rest, order: [...order] } : rest } satisfies BatchRecord);
  await done(tx);
}

export async function openSaved(batchId: string): Promise<BatchResult> {
  try {
    const stored = await storedBatch(batchId);
    if (!stored) throw new Error('That saved batch is no longer in this browser.');
    const images = (await database()).transaction(IMAGES, 'readonly').objectStore(IMAGES);
    // All requests are queued synchronously on one transaction before anything is awaited.
    const blobs = await Promise.all(stored.outputs.map((output) => request(images.get(imageKey(batchId, output.id))) as Promise<Blob | undefined>));
    const outputs: CropOutput[] = [], errors = [...stored.errors];
    stored.outputs.forEach((output, index) => {
      const blob = blobs[index];
      if (!(blob instanceof Blob)) { errors.push({ name: output.name, message: 'This saved copy is missing from browser storage.' }); return; }
      registerOutputFile(output, blob);
      outputs.push({ ...output, uri: URL.createObjectURL(blob) });
    });
    if (!outputs.length) throw new Error('This saved batch has no images left in browser storage. Remove it from the library.');
    return {
      id: batchId, createdAt: stored.summary.createdAt, savedAt: stored.summary.savedAt, outputs, errors,
      cancelled: stored.cancelled, total: stored.total, ...(stored.order ? { order: stored.order } : {}),
    };
  } catch (error) { throw friendly(error, 'GameShot could not open this saved batch.'); }
}

/** Removes the kept copy only; images already open in this session stay usable until the tab closes. */
export async function removeSaved(batchId: string): Promise<{ sessionCopyRemoved: boolean }> {
  try {
    const db = await database();
    const tx = db.transaction([BATCHES, IMAGES], 'readwrite');
    const prefix = imageKey(batchId, '');
    tx.objectStore(IMAGES).delete(IDBKeyRange.bound(prefix, `${prefix}\uffff`));
    tx.objectStore(BATCHES).delete(batchId);
    await done(tx);
    return { sessionCopyRemoved: false };
  } catch (error) { throw friendly(error, 'GameShot could not remove this saved batch.'); }
}
