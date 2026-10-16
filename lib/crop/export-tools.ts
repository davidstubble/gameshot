import { inPostingOrder } from './order';
import type { BatchResult, CropOutput } from './types';

/** One file in an export, in final posting order, with the filename it will be written as. */
export type ExportItem = { output: CropOutput; name: string; position: number };
export type PhotoGroup = { start: number; end: number };

export const TIKTOK_PHOTO_LIMIT = 35;

/** Import order unless the person explicitly arranged a different posting order. */
export function orderedOutputs(batch: Pick<BatchResult, 'outputs' | 'order'>): CropOutput[] {
  const imported = inPostingOrder(batch.outputs);
  const order = normalizeOrder(imported, batch.order);
  if (!order) return imported;
  const byId = new Map(imported.map((output) => [output.id, output]));
  return order.map((id) => byId.get(id)!);
}

/**
 * Accepts a custom order only when it is a complete permutation of the batch.
 * Returns undefined when it is missing, stale or identical to import order.
 */
export function normalizeOrder(outputs: readonly CropOutput[], order: readonly string[] | undefined): string[] | undefined {
  if (!order || order.length !== outputs.length) return undefined;
  const ids = new Set(outputs.map((output) => output.id));
  if (new Set(order).size !== order.length || order.some((id) => !ids.has(id))) return undefined;
  const imported = inPostingOrder(outputs).map((output) => output.id);
  return order.every((id, index) => id === imported[index]) ? undefined : [...order];
}

export function isCustomOrder(batch: Pick<BatchResult, 'outputs' | 'order'>): boolean {
  return !!normalizeOrder(batch.outputs, batch.order);
}

/** Moves one id by delta positions within the current order; out-of-range moves are ignored. */
export function moveInOrder(order: readonly string[], id: string, delta: number): string[] {
  const from = order.indexOf(id), to = from + delta;
  if (from < 0 || to < 0 || to >= order.length || delta === 0) return [...order];
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export function stripSequence(name: string): string {
  return name.replace(/^\d+_/, '');
}

/** Short filesystem-safe label, with a suffix to distinguish unsafe/truncated legacy IDs. */
function batchTag(raw: string): string {
  if (/^[A-Za-z0-9_-]{1,64}$/.test(raw)) return raw;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
  return `${raw.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48) || 'batch'}-${(hash >>> 0).toString(16)}`;
}

/** Copy/freeze before any await. Never renumber a retry subset: names come from the initial selection. */
export function snapshotExportItems(items: readonly ExportItem[]): readonly ExportItem[] {
  return Object.freeze(items.map((item) => Object.freeze({ ...item, output: Object.freeze({ ...item.output }) })));
}

/** Selected outputs in final order; filenames always represent positions within this exact selection. */
export function exportItems(batch: Pick<BatchResult, 'outputs' | 'order'>, selected?: ReadonlySet<string>): ExportItem[] {
  const chosen = orderedOutputs(batch).filter((output) => !selected || selected.has(output.id));
  const digits = Math.max(4, String(chosen.length).length);
  const tag = batchTag(chosen[0]?.batchId ?? 'batch');
  const items = chosen.map((output, index) => ({
    output,
    position: index + 1,
    name: `${String(index + 1).padStart(digits, '0')}_GameShot_${tag}.${output.format === 'jpeg' ? 'jpg' : 'png'}`,
  }));
  // Mutable type retained for existing UI props; runtime snapshot itself is immutable.
  return snapshotExportItems(items) as ExportItem[];
}

/** Consecutive one-based ranges no larger than a posting app's photo limit. */
export function photoGroups(count: number, limit = TIKTOK_PHOTO_LIMIT): PhotoGroup[] {
  if (!Number.isSafeInteger(count) || count <= 0 || !Number.isSafeInteger(limit) || limit <= 0) return [];
  const groups: PhotoGroup[] = [];
  for (let start = 1; start <= count; start += limit) groups.push({ start, end: Math.min(count, start + limit - 1) });
  return groups;
}

export function itemsBytes(items: readonly ExportItem[]): number {
  return items.reduce((sum, item) => sum + item.output.size, 0);
}

/** Unique folder name for one export, e.g. GameShot-2026-10-14-1003. */
export function exportFolderName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `GameShot-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}
