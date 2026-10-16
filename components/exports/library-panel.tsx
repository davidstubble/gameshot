import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton, Icon, mono, palette } from '@/components/crop/ui';
import { formatBytes } from '@/lib/crop/geometry';
import { LIBRARY_LIMITS, type SavedBatchSummary } from '@/lib/crop/library-rules';

type Props = {
  isPro: boolean; available: boolean; loaded: boolean; error: string | null; location: string;
  summaries: SavedBatchSummary[]; openIds: ReadonlySet<string>; busy: string | null;
  onOpen: (id: string) => void; onRemove: (summary: SavedBatchSummary) => void; onUnlock: () => void;
};

export const libraryKey = (id: string, action: 'open' | 'remove') => `library:${id}:${action}`;

export function LibraryPanel({ isPro, available, loaded, error, location, summaries, openIds, busy, onOpen, onRemove, onUnlock }: Props) {
  if (!available) return null;
  if (!isPro) return <Pressable accessibilityRole="button" accessibilityLabel="Unlock the on-device library with Pro" onPress={onUnlock} style={styles.teaser}>
    <View style={styles.teaserIcon}><Icon name="albums-outline" size={19} color={palette.lime} /></View>
    <View style={{ flex: 1 }}><Text style={styles.teaserTitle}>Keep batches and reopen them later</Text><Text style={styles.teaserText}>Pro saves finished batches on this device, so a refresh or closed app doesn’t lose them.</Text></View>
    <Text style={styles.teaserCTA}>Pro →</Text>
  </Pressable>;
  const used = summaries.reduce((sum, item) => sum + item.bytes, 0);
  return <View style={styles.panel}>
    <View style={styles.header}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="albums-outline" size={17} color={palette.lime} /><Text style={styles.title}>On this device</Text></View>
      <Text style={styles.usage}>{summaries.length}/{LIBRARY_LIMITS.batches}  ·  {formatBytes(used)} / 256 MB</Text>
    </View>
    <View style={styles.track}><View style={{ height: 3, width: `${Math.min(100, (used / LIBRARY_LIMITS.bytes) * 100)}%`, backgroundColor: palette.lime }} /></View>
    {error ? <Text style={styles.error}>{error}</Text> : !loaded ? <Text style={styles.empty}>Checking saved batches…</Text> : !summaries.length ? <Text style={styles.empty}>Nothing kept yet. Choose “Keep on this device” on a batch to reopen it later, even after closing GameShot.</Text> : summaries.map((item) => {
      const open = openIds.has(item.id);
      return <View key={item.id} style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{item.count} image{item.count === 1 ? '' : 's'}  ·  {item.width}×{item.height}</Text>
          <Text style={styles.rowMeta}>Cropped {new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}  ·  {formatBytes(item.bytes)}{item.skipped ? `  ·  ${item.skipped} skipped` : ''}</Text>
        </View>
        <ActionButton title={open ? 'Shown' : 'Open'} icon={open ? 'eye-outline' : 'open-outline'} secondary onPress={() => onOpen(item.id)} disabled={open || (!!busy && busy !== libraryKey(item.id, 'open'))} loading={busy === libraryKey(item.id, 'open')} style={styles.open} />
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove saved batch from ${new Date(item.createdAt).toLocaleString()}`} disabled={!!busy} onPress={() => onRemove(item)} style={[styles.remove, !!busy && { opacity: 0.4 }]}>
          <Icon name="trash-outline" size={18} color={palette.error} />
        </Pressable>
      </View>;
    })}
    <Text style={styles.note}>Stored only in {location}. Not a cloud backup: clearing site data, uninstalling or browser cleanup removes it.</Text>
  </View>;
}

const styles = StyleSheet.create({
  teaser: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#36452E', backgroundColor: '#1A211B', marginBottom: 18 },
  teaserIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#283522', alignItems: 'center', justifyContent: 'center' },
  teaserTitle: { color: palette.text, fontSize: 12, fontWeight: '600' },
  teaserText: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  teaserCTA: { color: palette.lime, fontSize: 11, fontWeight: '700' },
  panel: { backgroundColor: palette.panel, borderRadius: 14, borderWidth: 1, borderColor: palette.line, padding: 16, marginBottom: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  title: { color: palette.text, fontSize: 14, fontWeight: '600' },
  usage: { color: palette.muted, fontFamily: mono, fontSize: 10 },
  track: { height: 3, borderRadius: 2, backgroundColor: palette.line, overflow: 'hidden', marginTop: 11, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: palette.line },
  rowTitle: { color: palette.text, fontSize: 12, fontWeight: '600' },
  rowMeta: { color: palette.muted, fontSize: 10, marginTop: 3 },
  open: { minHeight: 44, paddingHorizontal: 13, paddingVertical: 8 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#4A312A' },
  empty: { color: palette.muted, fontSize: 11, lineHeight: 17, paddingVertical: 8 },
  error: { color: palette.error, fontSize: 11, lineHeight: 17, paddingVertical: 8 },
  note: { color: '#7F8A80', fontSize: 9, lineHeight: 14, marginTop: 8 },
});
