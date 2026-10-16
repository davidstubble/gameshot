import React, { useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { ActionButton, Icon, mono, palette } from '@/components/crop/ui';
import { PhotoViewer } from './photo-viewer';
import { TransferPlanner } from './transfer-planner';
import { gallerySelectionKey, galleryItemKey, type TransferTarget } from '@/lib/crop/transfer';
import { formatBytes } from '@/lib/crop/geometry';
import { exportItems, isCustomOrder, itemsBytes, moveInOrder, orderedOutputs, photoGroups, TIKTOK_PHOTO_LIMIT, type ExportItem } from '@/lib/crop/export-tools';
import { batchViewerItems } from '@/lib/crop/viewer-tools';
import { canShareImages, supportsFolderSave, supportsGallery } from '@/lib/crop/platform';
import type { BatchResult } from '@/lib/crop/types';

export type BatchActions = {
  share: (items: ExportItem[]) => void;
  folder: (items: ExportItem[]) => void;
  zip: (items: ExportItem[]) => void;
  gallery: (items: ExportItem[], signature: string) => void;
  single: (item: ExportItem) => void;
  keep: () => void;
  checklist: (items: ExportItem[], target: TransferTarget) => void;
  unlock: () => void;
  order: (order: string[] | undefined) => void;
};
type Props = {
  batch: BatchResult; latest: boolean; isPro: boolean; busy: string | null; galleryIds: ReadonlySet<string>;
  kept: boolean; libraryAvailable: boolean; actions: BatchActions;
};

export const actionKey = (batchId: string, action: string) => `${batchId}:${action}`;

export function BatchCard({ batch, latest, isPro, busy, galleryIds, kept, libraryAvailable, actions }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(batch.outputs.map((output) => output.id)));
  const [editing, setEditing] = useState(false);
  const [orderLocked, setOrderLocked] = useState(true);
  const [viewing, setViewing] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const ordered = useMemo(() => orderedOutputs(batch), [batch]);
  const all = useMemo(() => exportItems(batch), [batch]);
  const items = useMemo(() => exportItems(batch, selected), [batch, selected]);
  const selectedById = new Map(items.map((item) => [item.output.id, item]));
  const viewerItems = batchViewerItems(all, items);
  const custom = isCustomOrder(batch);
  const count = items.length, total = ordered.length;
  const groups = photoGroups(total);
  const columns = width >= 640 ? 5 : width >= 420 ? 4 : 3;
  const gap = 8, tile = width ? Math.floor((width - gap * (columns - 1)) / columns) : 0;
  const first = ordered[0];
  const ratio = first ? Math.min(2, Math.max(0.5, first.width / first.height)) : 1;
  const isBusy = (action: string) => busy === actionKey(batch.id, action);
  const locked = !!busy;
  const share = Platform.OS === 'web' && count > 0 && canShareImages(items);
  const folder = Platform.OS === 'web' && supportsFolderSave();
  const gallerySignature = gallerySelectionKey(items);
  const unsavedToGallery = items.filter((item) => !galleryIds.has(galleryItemKey(gallerySignature, item)));

  const toggle = (id: string) => { if (locked) return; setSelected((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const move = (id: string, delta: number) => { if (!orderLocked && !busy) actions.order(moveInOrder(ordered.map((output) => output.id), id, delta)); };
  const selectRange = (start: number, end: number) => { if (!locked) setSelected(new Set(ordered.slice(start - 1, end).map((output) => output.id))); };
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));

  return <View style={styles.batch}>
    <View style={styles.heading}>
      <View style={styles.mark}><Icon name={total ? 'checkmark' : 'alert-outline'} size={18} color={total ? palette.lime : palette.error} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{batch.cancelled ? 'Batch stopped' : total ? 'Batch cropped' : 'No images cropped'}</Text>
        <Text style={styles.meta}>{new Date(batch.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}  ·  {total} ready{batch.errors.length ? `  ·  ${batch.errors.length} skipped` : ''}{first ? `  ·  ${first.width}×${first.height}` : ''}</Text>
      </View>
      {kept ? <View style={styles.tag}><Icon name="phone-portrait-outline" size={10} color={palette.lime} /><Text style={styles.tagText}>ON DEVICE</Text></View> : latest ? <Text style={styles.latest}>LATEST</Text> : null}
    </View>

    {total ? <>
      <View style={styles.toolbar}>
        <Text style={styles.selectedText}><Text style={{ color: palette.lime }}>{count}</Text> of {total} selected{count ? `  ·  ${formatBytes(itemsBytes(items))}` : ''}</Text>
        <View style={styles.chips}>
          <Chip label="All" onPress={() => setSelected(new Set(ordered.map((output) => output.id)))} disabled={locked || count === total} />
          <Chip label="None" onPress={() => setSelected(new Set())} disabled={locked || count === 0} />
          <Chip label={orderLocked ? 'Order locked' : 'Lock order'} icon={orderLocked ? 'lock-closed-outline' : 'lock-open-outline'} active={orderLocked} disabled={locked} onPress={() => { setOrderLocked(!orderLocked); setEditing(false); }} />
          <Chip disabled={orderLocked || locked} label={editing ? 'Done' : 'Edit order'} icon={editing ? 'checkmark' : 'swap-vertical'} onPress={() => setEditing((value) => !value)} active={editing} />
        </View>
      </View>
      {custom ? <View style={styles.customOrder}><Icon name="git-compare-outline" size={14} color={palette.lime} /><Text style={styles.customText}>Custom posting order. Exported filenames are renumbered to match it.</Text><Pressable accessibilityRole="button" accessibilityLabel="Reset to import order" disabled={orderLocked || locked} onPress={() => { if (!orderLocked && !locked) actions.order(undefined); }} style={[styles.reset, (orderLocked || locked) && styles.dim]}><Text style={styles.resetText}>Reset</Text></Pressable></View> : null}
      <Text style={styles.hint}>{custom ? 'Chosen posting order' : 'Original import order'} protected. {orderLocked ? 'Unlock order only if you want to rearrange; exporting never sorts by original filename.' : 'Reordering enabled. Lock it again when ready.'}</Text>
      {groups.length > 1 ? <View style={styles.groups}>
        <Text style={styles.groupLabel}>TikTok takes {TIKTOK_PHOTO_LIMIT} photos per post:</Text>
        <View style={styles.chips}>{groups.map((group, i) => <Chip key={group.start} label={`Post ${i + 1} · ${group.start}–${group.end}`} onPress={() => selectRange(group.start, group.end)} />)}</View>
      </View> : null}

      <View onLayout={onLayout}>
        {editing ? <View>
          {all.map((item, index) => <View key={item.output.id} style={styles.orderRow}>
            <Text style={styles.orderNumber}>{selectedById.has(item.output.id) ? String(selectedById.get(item.output.id)!.position).padStart(2, '0') : '—'}</Text>
            <Image source={{ uri: item.output.uri }} resizeMode="cover" style={styles.orderThumb} />
            <Text numberOfLines={1} style={styles.orderName}>{selectedById.get(item.output.id)?.name ?? `Excluded · ${item.output.sourceName}`}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Move ${item.name} earlier`} disabled={index === 0} onPress={() => move(item.output.id, -1)} style={[styles.orderButton, index === 0 && styles.dim]}><Icon name="chevron-up" size={19} color={palette.text} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Move ${item.name} later`} disabled={index === all.length - 1} onPress={() => move(item.output.id, 1)} style={[styles.orderButton, index === all.length - 1 && styles.dim]}><Icon name="chevron-down" size={19} color={palette.text} /></Pressable>
          </View>)}
        </View> : tile ? <View style={[styles.grid, { gap }]}>
          {all.map((item, index) => {
            const on = selected.has(item.output.id);
            return <Pressable key={item.output.id} accessibilityRole="imagebutton" accessibilityLabel={`Open image ${item.position}, ${item.name}`} onPress={() => setViewing(index)}
              style={[styles.tile, { width: tile, height: Math.round(tile / ratio) }, !on && styles.tileOff]}>
              <Image source={{ uri: item.output.uri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
              <View style={styles.badge}><Text style={styles.badgeText}>{on ? String(selectedById.get(item.output.id)!.position).padStart(2, '0') : 'Excluded'}</Text></View>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${on ? 'Exclude' : 'Include'} image ${item.position}`} hitSlop={10} onPress={() => toggle(item.output.id)} style={[styles.check, on && styles.checkOn]}>
                {on ? <Icon name="checkmark" size={14} color={palette.bg} /> : null}
              </Pressable>
            </Pressable>;
          })}
        </View> : null}
      </View>
      {!editing ? <Text style={styles.hint}>Numbers match your selected export positions. Excluded pictures are not exported. Tap a crop to inspect it; tap its corner to include or exclude it.</Text> : null}
    </> : null}

    {batch.cancelled ? <Text style={styles.cancelled}>{batch.total - batch.outputs.length - batch.errors.length} images left unprocessed. Completed copies are safe.</Text> : null}
    {batch.errors.map((error, i) => <View key={`${batch.id}-error-${i}`} style={styles.errorRow}><Icon name="warning-outline" color={palette.error} size={14} /><View style={{ flex: 1 }}><Text style={styles.errorName}>{error.name}</Text><Text style={styles.errorMessage}>{error.message}</Text></View></View>)}

    {total ? <TransferPlanner all={all} selected={items} busy={locked} onSelect={(ids) => { if (!locked) setSelected(new Set(ids)); }} onChecklist={actions.checklist} /> : null}

    {total ? <View style={styles.actions}>
      <Text style={styles.warn}>Exact file order: save numbered ZIP/folder files, then Sort by Name ascending. Photos sorts by date added/captured—not filename—and may rearrange Save Images imports.</Text>
      <Text selectable style={styles.hint}>{items.length ? `Export names: ${items[0].name}${items.length > 1 ? ` → ${items[items.length - 1].name}` : ''}` : 'No selected export files.'}</Text>
      {count === 0 ? <Text style={styles.hint}>Select at least one image to export.</Text> : null}
      <ActionButton title={`Review export order · ${count}`} icon="eye-outline" secondary onPress={() => { setViewing(null); setReviewing(0); }} disabled={!count || locked} />
      <ActionButton title={Platform.OS === 'web' ? `Save numbered files (ZIP) · ${count}` : `Share numbered ZIP · ${count}`} icon={Platform.OS === 'web' ? 'download-outline' : 'share-outline'}
        secondary={false} onPress={() => actions.zip(items)} loading={isBusy('zip')} disabled={!count || (locked && !isBusy('zip'))} />
      {share ? <ActionButton title={`Share / Save to Photos · ${count}`} icon="share-outline" onPress={() => actions.share(items)} loading={isBusy('share')} disabled={locked && !isBusy('share')} /> : null}
      {share && count > TIKTOK_PHOTO_LIMIT ? <Text style={styles.warn}>TikTok accepts {TIKTOK_PHOTO_LIMIT} photos per post. Use the Post buttons above to select one group at a time.</Text> : null}
      {supportsGallery ? <ActionButton title={count && !unsavedToGallery.length ? 'Selected copies are in your gallery' : `Save to gallery · ${unsavedToGallery.length}`} icon={count && !unsavedToGallery.length ? 'checkmark-circle-outline' : 'images-outline'}
        onPress={() => actions.gallery(unsavedToGallery, gallerySignature)} loading={isBusy('gallery')} disabled={!unsavedToGallery.length || (locked && !isBusy('gallery'))} /> : null}
      {folder ? <ActionButton title={isPro ? `Save to a folder · ${count}` : 'Save to a folder · Pro'} icon={isPro ? 'folder-open-outline' : 'lock-closed-outline'} secondary={share}
        onPress={() => (isPro ? actions.folder(items) : actions.unlock())} loading={isBusy('folder')} disabled={(isPro && !count) || (locked && !isBusy('folder'))} /> : null}

      {libraryAvailable ? <ActionButton title={!isPro ? 'Keep on this device · Pro' : kept ? 'Kept on this device' : 'Keep on this device'} icon={!isPro ? 'lock-closed-outline' : kept ? 'checkmark-circle-outline' : 'save-outline'} secondary
        onPress={() => (isPro ? actions.keep() : actions.unlock())} loading={isBusy('keep')} disabled={(isPro && kept) || (locked && !isBusy('keep'))} /> : null}
    </View> : null}

    {reviewing !== null && items[reviewing] ? <PhotoViewer items={items} index={reviewing} selected={selected} busy={locked} orderLocked exportReview
      onClose={() => setReviewing(null)} onIndex={(index) => setReviewing(Math.max(0, Math.min(items.length - 1, index)))}
      onToggle={() => {}} onMove={() => {}} onExport={actions.single} /> : null}
    {viewing !== null && all[viewing] ? <PhotoViewer items={viewerItems} index={viewing} selected={selected} busy={locked} orderLocked={orderLocked} exportCount={count}
      onClose={() => setViewing(null)} onIndex={(index) => setViewing(Math.max(0, Math.min(all.length - 1, index)))}
      onToggle={toggle} onMove={move} onExport={(item) => actions.single(selectedById.get(item.output.id) ?? item)} /> : null}
  </View>;
}

function Chip({ label, onPress, disabled, active, icon }: { label: string; onPress: () => void; disabled?: boolean; active?: boolean; icon?: React.ComponentProps<typeof Icon>['name'] }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, selected: !!active }} disabled={disabled} onPress={onPress}
    style={[styles.chip, active && styles.chipActive, disabled && styles.dim]}>
    {icon ? <Icon name={icon} size={13} color={active ? palette.lime : palette.text} /> : null}
    <Text style={[styles.chipText, active && { color: palette.lime }]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  batch: { backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, borderRadius: 14, padding: 17, marginBottom: 18 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  mark: { backgroundColor: '#25321D', borderRadius: 9, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { color: palette.text, fontSize: 14, fontWeight: '600' },
  meta: { color: palette.muted, fontSize: 10, marginTop: 4 },
  latest: { color: palette.lime, fontSize: 8, letterSpacing: 0.8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 5, backgroundColor: palette.softLime },
  tagText: { color: palette.lime, fontSize: 8, letterSpacing: 0.7 },
  toolbar: { gap: 9, marginBottom: 12 },
  selectedText: { color: palette.muted, fontSize: 11, fontFamily: mono },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.raised, flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipActive: { borderColor: '#65813C', backgroundColor: palette.softLime },
  chipText: { color: palette.text, fontSize: 11, fontWeight: '600' },
  dim: { opacity: 0.35 },
  customOrder: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 9, backgroundColor: '#1C2518', borderWidth: 1, borderColor: '#37462A', marginBottom: 12 },
  customText: { flex: 1, color: '#CDDEB6', fontSize: 11, lineHeight: 16 },
  reset: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8, backgroundColor: palette.raised },
  resetText: { color: palette.text, fontSize: 11, fontWeight: '700' },
  groups: { gap: 7, marginBottom: 12 },
  groupLabel: { color: palette.muted, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { borderRadius: 8, overflow: 'hidden', backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.line },
  tileOff: { opacity: 0.4 },
  badge: { position: 'absolute', left: 5, top: 5, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(16,18,19,0.85)' },
  badgeText: { color: palette.lime, fontFamily: mono, fontSize: 10 },
  check: { position: 'absolute', right: 5, top: 5, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: palette.text, backgroundColor: 'rgba(16,18,19,0.6)', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: palette.lime, borderColor: palette.lime },
  hint: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 9 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6, borderTopWidth: 1, borderTopColor: palette.line },
  orderNumber: { color: palette.lime, fontFamily: mono, fontSize: 11, width: 24, textAlign: 'center' },
  orderThumb: { width: 54, height: 36, borderRadius: 5, backgroundColor: palette.bg },
  orderName: { flex: 1, color: palette.text, fontSize: 11 },
  orderButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: palette.line },
  cancelled: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 13 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 11, padding: 11, borderRadius: 7, backgroundColor: '#2A211E' },
  errorName: { color: palette.error, fontSize: 11 },
  errorMessage: { color: '#CBA593', fontSize: 10, lineHeight: 16, marginTop: 4 },
  actions: { gap: 9, marginTop: 17 },
  warn: { color: '#E8D18F', fontSize: 10, lineHeight: 16 },
});
