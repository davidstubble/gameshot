import type { CropOutput } from './types';

/** Sequence is assigned by the batch runner, never inferred from the original filename. */
export function inPostingOrder(outputs: readonly CropOutput[]): CropOutput[] {
  const ordered = [...outputs];
  // Hot-reloaded legacy session results have no sequence: keep their existing order.
  if (ordered.every((output) => Number.isSafeInteger(output.sequence) && (output.sequence ?? 0) > 0)) {
    ordered.sort((a, b) => a.sequence! - b.sequence!);
  }
  return ordered;
}

/** Most Recents pickers display newly added photos first. Never change source timestamps. */
export function gallerySaveOrder(outputs: readonly CropOutput[]): CropOutput[] {
  return inPostingOrder(outputs).reverse();
}
