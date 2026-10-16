import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { capacityError, isSafeFileName, readStoredBatch, sortSummaries, toStoredBatch, type SavedBatchSummary, type StoredBatch } from './library-rules';
import type { BatchResult, CropOutput } from './types';

const KEY = 'gameshot.library.v1';
/** Kept batches are copied out of temporary session storage into the app's private documents folder. */
export const libraryLocation = 'GameShot’s private storage on this phone';

async function readAll(): Promise<StoredBatch[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(readStoredBatch).filter((item): item is StoredBatch => !!item) : [];
  } catch { return []; }
}
async function writeAll(items: StoredBatch[]) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(items)); }
  catch { throw new Error('This phone would not update the GameShot library. Free some storage and try again.'); }
}
const keptFolder = (batchId: string) => new Directory(Paths.document, 'GameShot', 'kept', batchId);
const keptFile = (batchId: string, name: string) => new File(keptFolder(batchId), name);

export function libraryAvailable(): boolean { return true; }

export async function listSaved(): Promise<SavedBatchSummary[]> {
  return sortSummaries((await readAll()).map((item) => item.summary));
}

export async function keepBatch(batch: BatchResult): Promise<SavedBatchSummary> {
  if (!isSafeFileName(batch.id)) throw new Error('This batch cannot be kept.');
  for (const output of batch.outputs) {
    if (!isSafeFileName(output.name) || !new File(output.uri).exists) {
      throw new Error(`${output.name} is no longer in GameShot’s temporary storage, so this batch cannot be kept. Crop it again.`);
    }
  }
  const stored = toStoredBatch(batch);
  const all = await readAll();
  const problem = capacityError(all.map((item) => item.summary), stored.summary);
  if (problem) throw new Error(problem);
  const folder = keptFolder(batch.id);
  try {
    folder.create({ intermediates: true, idempotent: true });
    for (const output of batch.outputs) {
      const target = keptFile(batch.id, output.name);
      if (target.uri === output.uri) continue; // Already the kept copy (batch reopened from the library).
      if (target.exists) target.delete();
      await new File(output.uri).copy(target);
    }
  } catch {
    try { if (folder.exists) folder.delete(); } catch { /* Leave nothing half-kept when possible. */ }
    throw new Error('This phone ran out of space or refused to copy the batch. Free some storage and try again.');
  }
  await writeAll([stored, ...all.filter((item) => item.summary.id !== batch.id)]);
  return stored.summary;
}

export async function updateSavedOrder(batchId: string, order: string[] | undefined): Promise<void> {
  const all = await readAll();
  const index = all.findIndex((item) => item.summary.id === batchId);
  if (index < 0) return;
  const { order: _old, ...rest } = all[index];
  all[index] = order ? { ...rest, order: [...order] } : rest;
  await writeAll(all);
}

export async function openSaved(batchId: string): Promise<BatchResult> {
  const stored = (await readAll()).find((item) => item.summary.id === batchId);
  if (!stored) throw new Error('That saved batch is no longer on this device.');
  const outputs: CropOutput[] = [], errors = [...stored.errors];
  for (const output of stored.outputs) {
    const file = keptFile(batchId, output.name);
    if (file.exists) outputs.push({ ...output, uri: file.uri });
    else errors.push({ name: output.name, message: 'This saved copy was removed from the device.' });
  }
  if (!outputs.length) throw new Error('The images in this saved batch are no longer on this device. Remove it from the library.');
  return {
    id: batchId, createdAt: stored.summary.createdAt, savedAt: stored.summary.savedAt, outputs, errors,
    cancelled: stored.cancelled, total: stored.total, ...(stored.order ? { order: stored.order } : {}),
  };
}

/**
 * Deletes the kept copies first and only then forgets the batch, so a failed deletion stays listed
 * and can be retried. A batch reopened from the library points at these files, so it is gone too.
 */
export async function removeSaved(batchId: string): Promise<{ sessionCopyRemoved: boolean }> {
  if (!isSafeFileName(batchId)) throw new Error('This saved batch cannot be removed.');
  try { const folder = keptFolder(batchId); if (folder.exists) folder.delete(); }
  catch { throw new Error('Some saved files could not be deleted, so the batch is still listed. Try again in a moment.'); }
  const all = await readAll();
  await writeAll(all.filter((item) => item.summary.id !== batchId));
  return { sessionCopyRemoved: true };
}
