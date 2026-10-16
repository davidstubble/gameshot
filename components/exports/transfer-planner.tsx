import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton, mono, palette } from '@/components/crop/ui';
import { TRANSFER_TARGETS, transferGroups, type TransferTarget } from '@/lib/crop/transfer';
import type { ExportItem } from '@/lib/crop/export-tools';

type Props = {
  all: ExportItem[]; selected: ExportItem[]; busy: boolean;
  onSelect: (ids: string[]) => void;
  onChecklist: (items: ExportItem[], target: TransferTarget) => void;
};

export function TransferPlanner({ all, selected, busy, onSelect, onChecklist }: Props) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<TransferTarget>('TikTok');
  const [size, setSize] = useState('35');
  const groups = transferGroups(all.length, size);
  return <View style={styles.panel}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.toggle}>
      <Text style={styles.title}>Transfer to a posting app</Text><Text style={styles.accent}>{open ? '−' : '+'}</Text>
    </Pressable>
    {open ? <View style={styles.body}>
      <View style={styles.row}>{TRANSFER_TARGETS.map((name) => <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: target === name }} onPress={() => setTarget(name)} style={[styles.chip, name === target && styles.active]}><Text style={styles.label}>{name}</Text></Pressable>)}</View>
      <Text style={styles.help}>Choose a manageable group size for your account. These are transfer groups, not a promise about the app’s current upload limits.</Text>
      <View style={styles.row}><Text style={styles.label}>Images per group</Text><TextInput accessibilityLabel="Images per transfer group" keyboardType="number-pad" value={size} maxLength={4} onChangeText={setSize} editable={!busy} style={styles.input} /></View>
      {!groups.length ? <Text style={styles.error}>Enter a whole number from 1 to 1000.</Text> : <View style={styles.row}>{groups.map((group, index) => <Pressable key={group.start} accessibilityRole="button" accessibilityLabel={`Select group ${index + 1}, images ${group.start} to ${group.end}`} disabled={busy} onPress={() => onSelect(all.slice(group.start - 1, group.end).map((item) => item.output.id))} style={styles.chip}><Text style={styles.label}>Group {index + 1} · {group.start}–{group.end}</Text></Pressable>)}</View>}
      <Text style={styles.help}>Select a group, then use the photo, folder or ZIP action below. Files stay in the order shown. In {target === 'Other' ? 'your posting app' : target}, select numbered images in ascending order and check its preview before posting.</Text>
      {target === 'YouTube' ? <Text style={styles.help}>These are still images—not a Shorts video. Use an image-capable post or import them in this order into a slideshow/video editor.</Text> : null}
      <Text style={styles.help}>ZIPs include ORDER.txt and order.json mapping each final image back to its original input. Photo shares contain only images.</Text>
      <ActionButton title={`${Platform.OS === 'web' ? 'Download' : 'Share'} transfer checklist · ${selected.length}`} icon="document-text-outline" secondary disabled={busy || !selected.length} onPress={() => onChecklist(selected, target)} />
      <Text selectable style={styles.summary}>{selected.length ? `Selected sequence: ${selected.slice(0, 5).map((item) => item.name).join(' → ')}${selected.length > 5 ? ` → … (${selected.length} total)` : ''}` : 'No images selected.'}</Text>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: palette.line, borderRadius: 10, marginVertical: 12, backgroundColor: palette.bg },
  toggle: { minHeight: 48, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: palette.text, fontSize: 12, fontWeight: '600' }, accent: { color: palette.lime, fontSize: 20 },
  body: { padding: 12, paddingTop: 0, gap: 12 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 8 },
  active: { borderColor: palette.lime, backgroundColor: palette.softLime }, label: { color: palette.text, fontSize: 11 },
  input: { color: palette.text, fontFamily: mono, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, borderRadius: 8, minHeight: 44, width: 70, paddingHorizontal: 12 },
  help: { color: palette.muted, fontSize: 11, lineHeight: 17 }, error: { color: palette.error, fontSize: 11 },
  summary: { color: palette.lime, fontFamily: mono, fontSize: 10, lineHeight: 16 },
});
