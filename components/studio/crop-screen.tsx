import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { CropControls } from '@/components/crop/controls';
import { PresetLibrary } from '@/components/crop/preset-library';
import { CropPreview } from '@/components/crop/preview';
import { ImageQueue } from '@/components/crop/queue';
import { ActionButton, Icon, mono, Notice, palette, SectionLabel } from '@/components/crop/ui';
import { tryCropRect, validateSettings } from '@/lib/crop/geometry';
import { useCrop } from '@/lib/crop/store';
import { useBilling } from '@/lib/billing/store';
import { requiresPro } from '@/shared/billing';
import { PolicyLinks } from '@/components/web/info-screen';
import { StudioWordmark } from '@/components/studio/ui';

export default function CropStudio() {
  const crop = useCrop();
  const billing = useBilling();
  const router = useRouter();
  const wide = useWindowDimensions().width >= 820;
  const selected = crop.images.find((image) => image.id === crop.activeId);
  const validCount = crop.images.filter((image) => tryCropRect(image, crop.settings).rect).length;
  const invalidSettings = validateSettings(crop.settings);
  const rect = selected ? tryCropRect(selected, crop.settings).rect : null;
  const busy = crop.picking || crop.processing;
  async function handleCrop() {
    if (!crop.images.length) { await crop.addImages(); return; }
    if (requiresPro(crop.images.length) && !billing.isPro) {
      crop.setNotice('Free batches contain up to 3 selected images. Upgrade to Pro or remove extra images. Your queue stays in its original order.');
      router.push('/(tabs)/pro');
      return;
    }
    const result = await crop.process();
    if (result) router.push('/(tabs)/exports');
  }
  return <ScreenContainer containerClassName="bg-background" style={{ backgroundColor: palette.bg }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to GameShot LABS studio" onPress={() => router.push('/')}><StudioWordmark /></Pressable>
          <View style={styles.privateBadge}><Icon name="shield-checkmark-outline" size={12} color={palette.muted} /><Text style={styles.privateText}>ON-DEVICE ONLY</Text></View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 28 }}>
          <View style={styles.titleRow}>
            <View><Text role="heading" aria-level={1} className="font-semibold" style={styles.title}>Crop Lab</Text><Text style={styles.subtitle}>One precise crop. A whole batch of better shots.</Text></View>
            {wide ? <ActionButton title="Add images" icon="add" onPress={() => void crop.addImages()} secondary disabled={busy} style={{ minHeight: 44 }} /> : null}
          </View>
          <Pressable accessibilityLabel="View Pro access and purchase options" onPress={() => router.push('/(tabs)/pro')} style={styles.accessLink}><Text style={styles.accessCopy}>{billing.isPro ? 'PRO ACTIVE · larger batches' : 'FREE · up to 3 selected images per batch'}</Text><Text style={styles.accessCTA}>{billing.isPro ? 'Your access' : 'Pro · $9.99 once'} →</Text></Pressable>
          <View style={[styles.workspace, wide && { flexDirection: 'row', alignItems: 'flex-start', gap: 28 }]}>
            <View style={[styles.previewColumn, wide && { flex: 1.45 }]}>
              <SectionLabel number="01" title="Your images" aside={crop.images.length ? `${crop.images.length} in queue` : 'PNG · JPG · WEBP'} />
              <CropPreview source={selected} settings={crop.settings} onChange={crop.patchSettings} onPick={() => void crop.addImages()} disabled={busy} large={wide} />
              <ImageQueue images={crop.images} activeId={crop.activeId} settings={crop.settings} onSelect={crop.setActiveId} onAdd={() => void crop.addImages()} onRemove={crop.removeImage} disabled={busy} />
              <View style={styles.importRow}>
                <Pressable disabled={busy} accessibilityLabel="Choose images from gallery" onPress={() => void crop.addImages()} style={styles.importLink}><Icon name="images-outline" size={14} color={palette.lime} /><Text style={styles.linkText}>{crop.picking ? 'Opening images…' : 'Choose images'}</Text></Pressable>
                {Platform.OS !== 'web' ? <Pressable disabled={busy} accessibilityLabel="Import images from Files" onPress={() => void crop.addImages(true)} style={styles.importLink}><Icon name="folder-outline" size={14} /><Text style={styles.fileLink}>From Files</Text></Pressable> : null}
              </View>
              {wide ? <View style={styles.tip}><Icon name="information-circle-outline" size={17} color={palette.muted} /><View style={{ flex: 1 }}><Text style={styles.tipTitle}>Originals stay original.</Text><Text style={styles.tipCopy}>Crops are new copies. Your images never leave your device for processing, and your gallery stays untouched.</Text></View></View> : null}
            </View>
            <View style={[styles.controlsColumn, wide && { flex: 1 }]}>
              <SectionLabel number="02" title="Define your crop" aside="SOURCE PIXELS" />
              <CropControls settings={crop.settings} onChange={crop.patchSettings} disabled={busy} />
              {invalidSettings ? <View style={{ marginTop: 14 }}><Notice message={invalidSettings} error /></View> : null}
              {crop.images.length > validCount && !invalidSettings ? <View style={{ marginTop: 14 }}><Notice message={`${crop.images.length - validCount} image${crop.images.length - validCount === 1 ? '' : 's'} won't fit this crop. They will be skipped. Use Pixels or Aspect ratio to adjust.`} error /></View> : null}
              {rect ? <View style={styles.outputReadout}><Text style={styles.outputLabel}>PREVIEW OUTPUT</Text><Text style={styles.outputDimensions}>{rect.width} × {rect.height}<Text style={{ color: palette.muted, fontSize: 10 }}> px</Text></Text></View> : null}
              <PresetLibrary settings={crop.settings} onApply={crop.patchSettings} disabled={busy} isPro={billing.isPro} onUnlock={() => router.push('/(tabs)/pro')} />
            </View>
          </View>
          {crop.notice ? <View style={{ marginTop: 18 }}><Notice message={crop.notice} onDismiss={() => crop.setNotice(null)} /></View> : null}
          <PolicyLinks />
        </ScrollView>
        <View style={styles.actionArea}>
          {crop.processing ? <>
            <View style={styles.progressRow}><Text style={styles.progressText} numberOfLines={1}>Cropping {crop.currentName}</Text><Text style={styles.progressCount}>{crop.progress}/{crop.images.length}</Text></View>
            <View style={styles.progressTrack}><View style={{ height: 3, backgroundColor: palette.lime, width: `${crop.images.length ? crop.progress / crop.images.length * 100 : 0}%` }} /></View>
            <ActionButton title="Stop after current image" icon="stop-circle-outline" onPress={crop.cancel} secondary />
          </> : <>
            <ActionButton title={!crop.images.length ? 'Add screenshots' : requiresPro(crop.images.length) && !billing.isPro ? 'Unlock Pro for this batch' : `Crop ${validCount} image${validCount === 1 ? '' : 's'}`}
              icon={!crop.images.length ? 'add' : 'scan-outline'} onPress={() => void handleCrop()} loading={crop.picking}
              disabled={!!invalidSettings || (crop.images.length > 0 && validCount === 0)} />
            <View style={styles.bottomNote}><Icon name="lock-closed-outline" size={10} color="#798575" /><Text style={styles.bottomNoteText}>New copies only. No uploads. No surprises.</Text></View>
          </>}
        </View>
      </View>
    </KeyboardAvoidingView>
  </ScreenContainer>;
}
const styles = StyleSheet.create({
  shell: { flex: 1, width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 19, paddingBottom: 27 },
  brand: { fontSize: 23, letterSpacing: -0.9, color: palette.text, fontWeight: '700' },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 7, borderWidth: 1, borderColor: palette.line, borderRadius: 6 },
  privateText: { color: palette.muted, fontSize: 8, letterSpacing: 0.7 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 26 },
  title: { fontSize: 29, letterSpacing: -0.9, color: palette.text, fontWeight: '600' },
  subtitle: { fontSize: 11, color: palette.muted, marginTop: 7 },
  accessLink: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line, paddingVertical: 13, marginBottom: 24 },
  accessCopy: { color: palette.muted, fontSize: 9, flex: 1, lineHeight: 15 },
  accessCTA: { color: palette.lime, fontSize: 10, lineHeight: 15 },
  workspace: { gap: 28 },
  previewColumn: { minWidth: 0 },
  controlsColumn: { backgroundColor: palette.panel, borderRadius: 14, borderWidth: 1, borderColor: palette.line, padding: 18 },
  importRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  importLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  linkText: { color: palette.lime, fontSize: 11, fontWeight: '600' },
  fileLink: { color: palette.muted, fontSize: 11 },
  tip: { flexDirection: 'row', gap: 10, marginTop: 23, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 21 },
  tipTitle: { color: '#B8C0B6', fontSize: 12, fontWeight: '500' },
  tipCopy: { color: '#899586', fontSize: 11, lineHeight: 18, marginTop: 5, maxWidth: 440 },
  outputReadout: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.line, marginTop: 18, paddingTop: 15 },
  outputLabel: { color: '#83907E', fontSize: 8, letterSpacing: 0.8 },
  outputDimensions: { color: palette.lime, fontSize: 13, fontFamily: mono },
  actionArea: { paddingTop: 14, paddingBottom: 10, borderTopWidth: 1, borderTopColor: palette.line, backgroundColor: palette.bg },
  bottomNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 },
  bottomNoteText: { color: '#798575', fontSize: 9 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 9 },
  progressText: { color: palette.muted, fontSize: 11, flex: 1 },
  progressCount: { color: palette.lime, fontFamily: mono, fontSize: 11 },
  progressTrack: { backgroundColor: palette.raised, height: 3, borderRadius: 2, overflow: 'hidden', marginBottom: 13 },
});
