import type { BatchIssue, BatchResult, CropOutput, OutputFormat } from './types';

export const LIBRARY_LIMITS = { batches: 20, bytes: 256 * 1024 * 1024 } as const;

export type SavedBatchSummary = {
  id: string; createdAt: number; savedAt: number; count: number; bytes: number;
  skipped: number; width: number; height: number; format: OutputFormat;
};
export type StoredOutput = Omit<CropOutput, 'uri'>;
export type StoredBatch = {
  summary: SavedBatchSummary; outputs: StoredOutput[]; errors: BatchIssue[];
  cancelled: boolean; total: number; order?: string[];
};

export function summarize(batch: BatchResult, savedAt = Date.now()): SavedBatchSummary {
  const first = batch.outputs[0];
  return {
    id: batch.id, createdAt: batch.createdAt, savedAt, count: batch.outputs.length,
    bytes: batch.outputs.reduce((sum, output) => sum + output.size, 0), skipped: batch.errors.length,
    width: first?.width ?? 0, height: first?.height ?? 0, format: first?.format ?? 'png',
  };
}

export function toStoredBatch(batch: BatchResult, savedAt = Date.now()): StoredBatch {
  return {
    summary: summarize(batch, savedAt),
    outputs: batch.outputs.map(({ uri: _uri, ...output }) => output),
    errors: batch.errors.map((error) => ({ ...error })), cancelled: batch.cancelled, total: batch.total,
    ...(batch.order ? { order: [...batch.order] } : {}),
  };
}

/** Explains why a batch cannot be kept, or null if it fits. Re-saving the same batch replaces it. */
export function capacityError(existing: readonly SavedBatchSummary[], incoming: SavedBatchSummary): string | null {
  if (!incoming.count) return 'This batch has no finished images to keep.';
  const others = existing.filter((item) => item.id !== incoming.id);
  if (others.length >= LIBRARY_LIMITS.batches) {
    return `Your device library holds ${LIBRARY_LIMITS.batches} batches. Remove an older saved batch first.`;
  }
  const used = others.reduce((sum, item) => sum + item.bytes, 0);
  if (used + incoming.bytes > LIBRARY_LIMITS.bytes) {
    return `Not enough library space: this batch needs ${mb(incoming.bytes)} and ${mb(Math.max(0, LIBRARY_LIMITS.bytes - used))} of the 256 MB library is free. Remove a saved batch first.`;
  }
  return null;
}
const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const isText = (value: unknown, max = 300): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isFormat = (value: unknown): value is OutputFormat => value === 'png' || value === 'jpeg';
/** Saved names must be plain filenames so they can never address another folder. */
export const isSafeFileName = (value: unknown): value is string => isText(value, 200) && !/[\\/]|^\.\.?$/.test(value);

function readOutput(raw: unknown, batchId: string): StoredOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!isText(o.id) || !isText(o.sourceName) || !isSafeFileName(o.name) || o.batchId !== batchId || !isFormat(o.format)) return null;
  if (![o.width, o.height, o.size].every(isCount) || (o.width as number) < 1 || (o.height as number) < 1) return null;
  if (o.sequence !== undefined && (!isCount(o.sequence) || (o.sequence as number) < 1)) return null;
  return {
    id: o.id, sourceName: o.sourceName, name: o.name, batchId, format: o.format,
    width: o.width as number, height: o.height as number, size: o.size as number,
    ...(o.sequence !== undefined ? { sequence: o.sequence as number } : {}),
  };
}

/** Defensive parsing of device storage: corrupt or foreign records are ignored rather than crashing. */
export function readStoredBatch(raw: unknown): StoredBatch | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const s = r.summary as Record<string, unknown> | undefined;
  if (!s || !isSafeFileName(s.id) || !Array.isArray(r.outputs) || !Array.isArray(r.errors)) return null;
  if (![s.createdAt, s.savedAt, s.bytes, s.skipped, s.width, s.height, r.total].every(isCount) || !isFormat(s.format)) return null;
  const outputs = r.outputs.map((output) => readOutput(output, s.id as string));
  if (!outputs.length || outputs.some((output) => !output)) return null;
  const errors = r.errors.filter((e): e is BatchIssue => !!e && typeof e === 'object' && isText((e as BatchIssue).name) && typeof (e as BatchIssue).message === 'string');
  const order = Array.isArray(r.order) && r.order.every((id) => typeof id === 'string') ? r.order as string[] : undefined;
  const valid = outputs as StoredOutput[];
  return {
    summary: {
      id: s.id, createdAt: s.createdAt as number, savedAt: s.savedAt as number, count: valid.length,
      bytes: valid.reduce((sum, output) => sum + output.size, 0), skipped: s.skipped as number,
      width: s.width as number, height: s.height as number, format: s.format,
    },
    outputs: valid, errors, cancelled: r.cancelled === true, total: r.total as number, ...(order ? { order } : {}),
  };
}

export function sortSummaries(items: readonly SavedBatchSummary[]): SavedBatchSummary[] {
  return [...items].sort((a, b) => b.savedAt - a.savedAt);
}
