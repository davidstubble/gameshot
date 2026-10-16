import React from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatBytes } from '@/lib/crop/geometry';
import type { ExportItem } from '@/lib/crop/export-tools';
import type { ViewerItem } from '@/lib/crop/viewer-tools';
import { Icon, mono, palette } from '@/components/crop/ui';

type Props = {
  items: ViewerItem[]; index: number; selected: ReadonlySet<string>; busy: boolean; orderLocked: boolean;
  exportReview?: boolean; exportCount?: number;
  onClose: () => void; onIndex: (index: number) => void; onToggle: (id: string) => void;
  onMove: (id: string, delta: number) => void; onExport: (item: ExportItem) => void;
};

/** Full-screen inspection of one crop in posting order. Moving keeps the same photo on screen. */
export function PhotoViewer({ items, index, selected, busy, orderLocked, exportReview = false, exportCount, onClose, onIndex, onToggle, onMove, onExport }: Props) {
  const insets = useSafeAreaInsets();
  const item = items[index];
  if (!item) return null;
  const { output } = item, isSelected = selected.has(output.id), last = items.length - 1;
  const move = (delta: number) => { if (busy || orderLocked) return; onMove(output.id, delta); onIndex(index + delta); };
  return <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close preview" onPress={onClose} style={styles.iconButton}><Icon name="close" size={24} color={palette.text} /></Pressable>
        <Text accessibilityLabel={`${exportReview ? 'Export' : 'Batch image'} ${index + 1} of ${items.length}`} style={styles.counter}>{exportReview ? 'Export' : 'Image'} {String(index + 1).padStart(2, '0')} <Text style={{ color: palette.muted }}>/ {String(items.length).padStart(2, '0')}</Text></Text>
        {!exportReview ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: isSelected }} accessibilityLabel={isSelected ? 'Selected for export. Tap to exclude.' : 'Excluded from export. Tap to include.'}
          disabled={busy} onPress={() => onToggle(output.id)} style={[styles.selectPill, isSelected && styles.selectPillOn]}>
          <Icon name={isSelected ? 'checkmark-circle' : 'ellipse-outline'} size={17} color={isSelected ? palette.bg : palette.text} />
          <Text style={[styles.selectText, isSelected && { color: palette.bg }]}>{isSelected ? 'Selected' : 'Excluded'}</Text>
        </Pressable> : null}
      </View>
      <View style={styles.stage}>
        <Image source={{ uri: output.uri }} resizeMode="contain" style={styles.image} accessibilityLabel={`Cropped image ${item.name}`} />
        <Pressable accessibilityRole="button" accessibilityLabel="Previous image" disabled={index === 0} onPress={() => onIndex(index - 1)} style={[styles.nav, { left: 6 }, index === 0 && styles.disabled]}><Icon name="chevron-back" size={26} color={palette.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Next image" disabled={index === last} onPress={() => onIndex(index + 1)} style={[styles.nav, { right: 6 }, index === last && styles.disabled]}><Icon name="chevron-forward" size={26} color={palette.text} /></Pressable>
      </View>
      <View style={styles.footer}>
        <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>{exportReview ? 'Exact selected image and filename for ZIP / folder export.' : item.exportPosition ? `Export ${item.exportPosition} of ${exportCount ?? items.length} selected · batch image ${index + 1}` : 'Excluded from the selected batch export. Download below exports this image separately.'}</Text>
        <Text style={styles.meta}>{output.width} × {output.height} px  ·  {formatBytes(output.size)}  ·  from {output.sourceName}</Text>
        <View style={styles.actions}>
          {!exportReview ? <><Pressable accessibilityRole="button" accessibilityLabel="Move earlier in posting order" disabled={index === 0 || orderLocked || busy} onPress={() => move(-1)} style={[styles.action, (index === 0 || orderLocked || busy) && styles.disabled]}><Icon name="arrow-back" size={17} color={palette.text} /><Text style={styles.actionText}>Earlier</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Move later in posting order" disabled={index === last || orderLocked || busy} onPress={() => move(1)} style={[styles.action, (index === last || orderLocked || busy) && styles.disabled]}><Text style={styles.actionText}>Later</Text><Icon name="arrow-forward" size={17} color={palette.text} /></Pressable></> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={Platform.OS === 'web' ? `Download ${item.name}` : `Share ${item.name}`} disabled={busy} onPress={() => onExport(item)} style={[styles.action, styles.exportAction, busy && styles.disabled]}>
            <Icon name={Platform.OS === 'web' ? 'download-outline' : 'share-outline'} size={17} color={palette.bg} /><Text style={[styles.actionText, { color: palette.bg }]}>{Platform.OS === 'web' ? 'Download' : 'Share'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#070808', paddingHorizontal: 14 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: palette.raised },
  counter: { color: palette.lime, fontFamily: mono, fontSize: 15 },
  selectPill: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.raised },
  selectPillOn: { backgroundColor: palette.lime, borderColor: palette.lime },
  selectText: { color: palette.text, fontSize: 12, fontWeight: '700' },
  stage: { flex: 1, justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  nav: { position: 'absolute', top: '50%', marginTop: -24, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(25,28,29,0.85)', borderWidth: 1, borderColor: palette.line },
  disabled: { opacity: 0.3 },
  footer: { paddingTop: 12, gap: 6 },
  name: { color: palette.text, fontSize: 13, fontWeight: '600' },
  meta: { color: palette.muted, fontSize: 10, fontFamily: mono },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  action: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.raised },
  exportAction: { backgroundColor: palette.lime, borderColor: palette.lime },
  actionText: { color: palette.text, fontSize: 12, fontWeight: '700' },
});
