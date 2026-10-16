import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CropSettings, SourceImage } from '@/lib/crop/types';
import { tryCropRect } from '@/lib/crop/geometry';
import { Icon, palette } from './ui';
export function ImageQueue({ images, activeId, settings, onSelect, onAdd, onRemove, disabled }: {
  images: SourceImage[]; activeId: string | null; settings: CropSettings; onSelect: (id: string) => void;
  onAdd: () => void; onRemove: (id: string) => void; disabled: boolean;
}) {
  const active = images.find((image) => image.id === activeId);
  return <View style={{ marginTop: 20 }}>
    <View style={styles.header}><Text style={styles.label}>BATCH QUEUE <Text style={{ color: palette.lime }}>{String(images.length).padStart(2, '0')}</Text></Text>
      {active ? <Pressable accessibilityLabel={`Remove ${active.name}`} disabled={disabled} onPress={() => onRemove(active.id)} style={styles.remove}><Icon name="trash-outline" size={13} /><Text style={styles.removeText}>Remove selected</Text></Pressable> : null}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingTop: 2, paddingBottom: 5 }}>
      {images.map((image, index) => {
        const valid = !!tryCropRect(image, settings).rect;
        return <Pressable key={image.id} onPress={() => onSelect(image.id)} disabled={disabled} accessibilityLabel={`Preview ${image.name}`} accessibilityState={{ selected: image.id === activeId }} style={[styles.thumb, image.id === activeId && { borderColor: palette.lime }]}>
          <Image source={{ uri: image.uri }} style={{ width: 66, height: 66 }} resizeMode="cover" />
          <View style={styles.index}><Text style={{ color: palette.text, fontSize: 8 }}>{index + 1}</Text></View>
          {!valid ? <View style={styles.warning}><Icon name="warning" color={palette.error} size={10} /></View> : null}
        </Pressable>;
      })}
      <Pressable accessibilityLabel="Add more images" onPress={onAdd} disabled={disabled} style={styles.add}><Icon name="add" color={palette.muted} size={22} /><Text style={{ color: palette.muted, fontSize: 8 }}>ADD</Text></Pressable>
    </ScrollView>
    {active ? <Text numberOfLines={1} style={styles.filename}>{active.name}</Text> : <Text style={styles.filename}>Select several screenshots. Apply one crop to all.</Text>}
    {images.length ? <Text style={styles.orderHint}>Import order = posting order. Export names start with 0001, 0002, …</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: palette.muted, fontSize: 9, letterSpacing: 1.2 },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32 },
  removeText: { color: palette.muted, fontSize: 9 },
  thumb: { width: 70, height: 70, borderRadius: 9, overflow: 'hidden', borderWidth: 2, borderColor: palette.line, backgroundColor: palette.panel },
  index: { position: 'absolute', bottom: 3, left: 3, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: '#161A16' },
  warning: { position: 'absolute', top: 3, right: 3, padding: 3, backgroundColor: '#241715', borderRadius: 3 },
  add: { width: 70, height: 70, borderWidth: 1, borderStyle: 'dashed', borderColor: '#455044', borderRadius: 9, alignItems: 'center', justifyContent: 'center', gap: 4 },
  filename: { color: '#828D84', fontSize: 10, marginTop: 7 },
  orderHint: { color: palette.muted, fontSize: 9, marginTop: 5, lineHeight: 14 },
});
