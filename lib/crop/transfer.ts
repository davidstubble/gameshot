import { photoGroups, type ExportItem } from './export-tools';

export type TransferTarget = 'TikTok' | 'Instagram' | 'YouTube' | 'Other';
export const TRANSFER_TARGETS: TransferTarget[] = ['TikTok', 'Instagram', 'YouTube', 'Other'];

export function parseGroupSize(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 1 && count <= 1000 ? count : null;
}
export function transferGroups(count: number, value: string) {
  const size = parseGroupSize(value);
  return size === null ? [] : photoGroups(count, size);
}

/** Order tracking includes the entire selection, not just individual IDs: Recents uses save time. */
export function gallerySelectionKey(items: readonly ExportItem[]): string {
  return JSON.stringify(items.map((item) => [item.output.id, item.name]));
}
export function galleryItemKey(selectionKey: string, item: ExportItem): string {
  return `${selectionKey}:${item.output.id}`;
}

/** Match the entire filename; splitting error text on ':' corrupts names containing colons. */
export function successfulGalleryItems(items: readonly ExportItem[], errors: readonly string[]): ExportItem[] {
  return items.filter((item) => !errors.some((error) => error.startsWith(`${item.name}: `)));
}

export function orderReceipt(items: readonly ExportItem[]) {
  return {
    schemaVersion: 1,
    note: 'Files are listed in final posting order. Sort cropped/ by Name ascending; Photos uses date added/captured and may rearrange imports. Then select in this sequence and check the destination app preview before posting. Import position is the order returned by the image picker, not a guaranteed tap order on every device.',
    images: items.map((item) => ({
      position: item.position,
      importPosition: item.output.sequence ?? null,
      sourceName: item.output.sourceName,
      exportName: item.name,
      width: item.output.width,
      height: item.output.height,
    })),
  };
}

export function transferChecklist(items: readonly ExportItem[], target: TransferTarget = 'Other'): string {
  const lines = [
    `GameShot — ${target === 'Other' ? 'ordered image transfer' : `${target} transfer checklist`}`,
    `${items.length} cropped image copies. Originals are untouched.`,
    '',
    '1. Save/extract the images first (ZIP: open cropped/).',
    '2. Files: open cropped/ and Sort by Name ascending (iPhone: … → Name). Select images in the sequence below.',
    '3. Check the numbered thumbnails in that app before posting; an app can change its own sorting.',
    '4. Photos sorts by date added/captured, not filename. Importing into Photos may rearrange display order.',
    '5. Post only after you confirm the intended order.',
    ...(target === 'YouTube' ? ['YouTube: these are images, not a video. Use an image-capable post or import them in this order into a slideshow/video editor for a video upload.'] : []),
    '',
    'POSTING ORDER',
    ...items.map((item) => `${String(item.position).padStart(Math.max(4, String(items.length).length), '0')}. ${item.name} | source: ${item.output.sourceName} | import: ${item.output.sequence ?? 'legacy'} | ${item.output.width}x${item.output.height}`),
    '',
    'Only selected successful crops are included. Skipped/failed crops are not silently substituted.',
    'Group size is a planning choice; check the destination app’s current limits.',
    '',
  ];
  return lines.join('\n');
}
