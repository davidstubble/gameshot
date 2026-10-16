import type { ExportItem } from './export-tools';

export type ViewerItem = ExportItem & { exportPosition?: number };

/** Browse every batch image without confusing its batch position with selected-export position. */
export function batchViewerItems(all: readonly ExportItem[], selected: readonly ExportItem[]): ViewerItem[] {
  const byId = new Map(selected.map((item) => [item.output.id, item]));
  return all.map((item) => {
    const chosen = byId.get(item.output.id);
    return { ...item, name: chosen?.name ?? item.name, exportPosition: chosen?.position };
  });
}
