import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, palette, type IconName } from '@/components/crop/ui';

const WEB: { icon: IconName; title: string; text: string }[] = [
  { icon: 'download-outline', title: 'Save numbered files (ZIP) — reliable file order', text: 'Downloads one ZIP. iPhone: Files → Downloads → tap the ZIP to extract → open cropped/ → … → Name, ascending. Desktop/Android: extract cropped/ and sort by Name ascending. Names start with 0001, 0002… and match this exact selection, including your custom order.' },
  { icon: 'folder-open-outline', title: 'Save to a folder (Pro, desktop Chrome/Edge)', text: 'Creates a new folder with the same numbered files. Sort that folder by Name ascending. Existing files are never overwritten. Firefox and Safari use ZIP instead.' },
  { icon: 'share-outline', title: 'Share / Save to Photos — display order may change', text: 'Sends numbered image files in the selected order to the system share sheet. Save Images makes Photos copies, but iPhone Photos sorts by date added or captured—not filename. The receiving app can reorder imports. Saving a ZIP to Files keeps the reliable numbered-file route available.' },
  { icon: 'albums-outline', title: 'Keep on this device (Pro)', text: 'Keeps the batch in this browser for reopening. This is local storage, not a cloud backup.' },
];
const NATIVE: { icon: IconName; title: string; text: string }[] = [
  { icon: 'share-outline', title: 'Share numbered ZIP — reliable file order', text: 'Choose Save to Files in the share sheet. In Files, tap the ZIP to extract, open cropped/ and choose … → Name, ascending. Each file has the same numbered name as your selected export.' },
  { icon: 'images-outline', title: 'Save to gallery — display order may change', text: 'Saves new numbered copies one at a time, last-to-first as a best effort for newest-first pickers. Photos and social apps still control their own sorting. Partial retries add missing copies later, so date-based layout may differ. For reliable filename ordering, use ZIP → Files → Sort by Name.' },
  { icon: 'albums-outline', title: 'Keep on this device (Pro)', text: 'Copies the batch into private app storage for reopening. Unkept batches clear on the next launch. Uninstalling removes kept batches too.' },
];

export function SaveGuide() {
  const [open, setOpen] = useState(false);
  const rows = Platform.OS === 'web' ? WEB : NATIVE;
  return <View style={styles.box}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel="Where do my pictures go?" onPress={() => setOpen((value) => !value)} style={styles.head}>
      <Icon name="help-circle-outline" size={18} color={palette.lime} />
      <Text style={styles.headText}>Where do my pictures go?</Text>
      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={17} />
    </Pressable>
    {open ? <View style={{ gap: 13, paddingTop: 4 }}>
      {rows.map((row) => <View key={row.title} style={styles.row}>
        <Icon name={row.icon} size={16} color={palette.lime} />
        <View style={{ flex: 1 }}><Text style={styles.title}>{row.title}</Text><Text style={styles.text}>{row.text}</Text></View>
      </View>)}
      <View style={styles.row}>
        <Icon name="logo-tiktok" size={16} color={palette.lime} />
        <View style={{ flex: 1 }}><Text style={styles.title}>TikTok, Instagram and other posting apps</Text><Text style={styles.text}>Use the numbered files and order receipt as a reference. If your posting app only picks from Photos, compare with GameShot’s thumbnails, select in the intended sequence and check its final preview. Importing a name-sorted folder into Photos does not guarantee that Photos keeps that order.</Text></View>
      </View>
      <Text style={styles.foot}>Export renaming copies the existing image bytes. It does not change pixels, capture dates or your originals.</Text>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  box: { borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: '#151819', paddingHorizontal: 14, paddingBottom: 6, marginBottom: 18 },
  head: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9 },
  headText: { flex: 1, color: palette.text, fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { color: palette.text, fontSize: 11, fontWeight: '600', marginBottom: 3 },
  text: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  foot: { color: '#7F8A80', fontSize: 10, marginBottom: 8 },
});
