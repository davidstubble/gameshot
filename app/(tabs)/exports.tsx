import React, { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { ActionButton, CropMark, Icon, mono, Notice, palette } from '@/components/crop/ui';
import { actionKey, BatchCard, type BatchActions } from '@/components/exports/batch-card';
import { LibraryPanel, libraryKey } from '@/components/exports/library-panel';
import { SaveGuide } from '@/components/exports/save-guide';
import { confirmAction } from '@/lib/confirm';
import { formatBytes } from '@/lib/crop/geometry';
import { galleryItemKey, successfulGalleryItems } from '@/lib/crop/transfer';
import { normalizeOrder, TIKTOK_PHOTO_LIMIT, type ExportItem } from '@/lib/crop/export-tools';
import { saveToFolder, saveToGallery, shareImages, shareOutputs, shareSingle, shareTransferPlan } from '@/lib/crop/platform';
import { useCrop } from '@/lib/crop/store';
import { useDeviceLibrary } from '@/lib/crop/use-library';
import type { BatchResult } from '@/lib/crop/types';
import type { SavedBatchSummary } from '@/lib/crop/library-rules';
import { useBilling } from '@/lib/billing/store';

type Outcome = { message: string; error?: boolean } | null | void;
const plural = (n: number, word = 'image') => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function ExportsScreen() {
  const crop = useCrop();
  const billing = useBilling();
  const router = useRouter();
  const library = useDeviceLibrary(billing.isPro);
  const [busy, setBusy] = useState<string | null>(null);
  const exportInFlight = useRef(false);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [galleryIds, setGalleryIds] = useState(new Set<string>());
  const total = crop.batches.reduce((sum, batch) => sum + batch.outputs.length, 0);
  const openIds = new Set(crop.batches.map((batch) => batch.id));

  /** Runs an export. The action starts synchronously so browser pickers/share sheets stay inside the tap. */
  function run(key: string, action: () => Promise<Outcome>) {
    if (exportInFlight.current) return;
    exportInFlight.current = true;
    setBusy(key); setNotice(null);
    let pending: Promise<Outcome>;
    try { pending = action(); } catch (error) { pending = Promise.reject(error); }
    pending.then((outcome) => { if (outcome) setNotice({ message: outcome.message, error: !!outcome.error }); })
      .catch((error) => setNotice({ message: error instanceof Error ? error.message : 'Export failed.', error: true }))
      .finally(() => { exportInFlight.current = false; setBusy(null); });
  }
  const unlock = () => router.push('/(tabs)/pro');

  function actionsFor(batch: BatchResult): BatchActions {
    const key = (action: string) => actionKey(batch.id, action);
    return {
      share: (items) => run(key('share'), async () => {
        if (!(await shareImages(items))) return null; // Closed share sheet: not a success, not an error.
        return { message: `Sent ${plural(items.length)} as numbered files in your chosen order. Photos may display them by date added or captured, not filename. For reliable filename order, use Save numbered files (ZIP) → Files → unzip → cropped → Sort by Name. Check the posting app preview before publishing.${items.length > TIKTOK_PHOTO_LIMIT ? ` TikTok accepts ${TIKTOK_PHOTO_LIMIT} per post, so split this selection.` : ''}` };
      }),
      folder: (items) => run(key('folder'), async () => {
        const result = await saveToFolder(items);
        if (!result) return null;
        const failed = result.errors.length;
        return { message: `Saved ${plural(result.saved)} as separate numbered files in “${result.folder}”. Sort that folder by Name ascending to match your chosen order.${failed ? `\n${failed} could not be written:\n${result.errors.join('\n')}` : ''}`, error: failed > 0 };
      }),
      zip: (items) => run(key('zip'), async () => {
        const name = await shareOutputs(items, batch.id);
        if (Platform.OS !== 'web') return null; // The share sheet decides the destination; nothing to claim.
        return { message: `Downloading ${name} (${plural(items.length)}) to your browser’s Downloads folder. On iPhone: Files → Downloads → tap the ZIP to extract → open cropped/ → … → Name (ascending). On desktop/Android: extract cropped/ and sort by Name. The numbered files follow your chosen order. ZIP files don’t appear in Photos; importing them into Photos can change display order.` };
      }),
      checklist: (items, target) => run(key('checklist'), async () => {
        const name = await shareTransferPlan(items, target);
        return Platform.OS === 'web' ? { message: `Downloading ${name} to Downloads. This checklist lists only the selected crops in their final order.` } : null;
      }),
      gallery: (items, signature) => run(key('gallery'), async () => {
        const result = await saveToGallery(items);
        setGalleryIds((old) => {
          const next = new Set(old);
          successfulGalleryItems(items, result.errors).forEach((item) => next.add(galleryItemKey(signature, item)));
          return next;
        });
        return { message: `${result.saved} new cop${result.saved === 1 ? 'y' : 'ies'} saved to Photos / Gallery as numbered copies with sequential writes. Photos controls its own date-based display order; partial retries add new copies and can change that display. Use numbered ZIP/folder files sorted by Name when exact file order matters.${result.errors.length ? `\n${result.errors.join('\n')}` : ''}`, error: result.errors.length > 0 };
      }),
      single: (item: ExportItem) => run(key('single'), async () => {
        await shareSingle(item.output, item.name);
        return Platform.OS === 'web' ? { message: `Downloading ${item.name} to your browser’s Downloads folder.` } : null;
      }),
      keep: () => run(key('keep'), async () => {
        const summary = await library.keep(batch);
        return { message: `Kept ${plural(summary.count)} (${formatBytes(summary.bytes)}) in ${library.location}. Reopen it from “On this device” anytime, even after closing GameShot.` };
      }),
      unlock,
      order: (order) => {
        if (busy) return;
        crop.setBatchOrder(batch.id, order);
        if (library.savedIds.has(batch.id)) {
          void library.updateOrder(batch.id, normalizeOrder(batch.outputs, order)).catch(() =>
            setNotice({ message: 'The new order is shown here, but the saved copy on this device kept its previous order.', error: true }));
        }
      },
    };
  }

  function openSaved(id: string) {
    run(libraryKey(id, 'open'), async () => {
      const batch = await library.open(id);
      crop.openBatch(batch);
      const missing = batch.errors.length;
      return { message: `Opened ${plural(batch.outputs.length)} kept on this device.${missing ? ' Some saved copies were missing and are listed under the batch.' : ''}` };
    });
  }
  async function removeSaved(summary: SavedBatchSummary) {
    if (busy) return;
    const shown = crop.batches.find((batch) => batch.id === summary.id);
    const ok = await confirmAction('Remove saved batch?', `This deletes the ${plural(summary.count)} GameShot kept on this device (${formatBytes(summary.bytes)}). Your originals and any copies already in Photos, Downloads or folders are not affected.`);
    if (!ok) return;
    run(libraryKey(summary.id, 'remove'), async () => {
      const result = await library.remove(summary.id);
      // Only a batch reopened from the library shows the deleted files; a fresh session batch is unaffected.
      const dropped = !!shown && result.sessionCopyRemoved && shown.savedAt !== undefined;
      if (dropped) crop.removeBatch(summary.id);
      return { message: shown && !dropped ? `Saved copy removed. The images shown below stay available until you close ${Platform.OS === 'web' ? 'this tab' : 'GameShot'}.` : 'Saved batch removed from this device.' };
    });
  }

  return <ScreenContainer style={{ backgroundColor: palette.bg }}>
    <View style={styles.shell}>
      <View style={styles.header}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><CropMark size={27} /><Text style={styles.brand}>GameShot<Text style={{ color: palette.lime }}>.</Text></Text></View><Text style={styles.sessionTag}>{billing.isPro && library.available ? 'SESSION + DEVICE' : 'THIS SESSION'}</Text></View>
      <View style={styles.titleRow}><View style={{ flex: 1 }}><Text role="heading" aria-level={1} style={styles.title}>Your exports</Text><Text style={styles.subtitle}>Review, pick, order and save. Originals stay untouched.</Text></View><View style={styles.count}><Text style={styles.countText}>{String(total).padStart(2, '0')}</Text></View></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {notice ? <View style={{ marginBottom: 18 }}><Notice message={notice.message} error={notice.error} onDismiss={() => setNotice(null)} /></View> : null}
        <LibraryPanel isPro={billing.isPro} available={library.available} loaded={library.loaded} error={library.error} location={library.location}
          summaries={library.summaries} openIds={openIds} busy={busy} onOpen={openSaved} onRemove={(summary) => void removeSaved(summary)} onUnlock={unlock} />
        {!crop.batches.length ? <View style={styles.empty}>
          <View style={styles.emptyIcon}><Icon name="layers-outline" color={palette.lime} size={33} /></View>
          <Text style={styles.emptyTitle}>Good crops belong here.</Text>
          <Text style={styles.emptyText}>{crop.processing ? 'Your batch is processing in Crop studio.' : billing.isPro && library.summaries.length ? 'Open a batch kept on this device above, or crop a new one.' : 'Choose your images and define a crop. Your finished copies will appear here.'}</Text>
          <ActionButton title="Back to crop studio" icon="arrow-back" onPress={() => router.push('/(tabs)')} secondary style={{ marginTop: 25 }} />
        </View> : <>
          <SaveGuide />
          {!billing.isPro || !library.available ? <View style={styles.sessionNote}><Icon name="time-outline" size={15} color={palette.muted} /><Text style={styles.sessionText}>{Platform.OS === 'web' ? 'Unsaved batches disappear when you close or refresh this tab. Save them first.' : 'Unsaved batch history clears when the app closes. Save your copies first.'}</Text></View> : null}
          {crop.batches.map((batch, index) => <BatchCard key={batch.id} batch={batch} latest={index === 0} isPro={billing.isPro} busy={busy}
            galleryIds={galleryIds} kept={library.savedIds.has(batch.id)} libraryAvailable={library.available} actions={actionsFor(batch)} />)}
        </>}
      </ScrollView>
    </View>
  </ScreenContainer>;
}
const styles = StyleSheet.create({
  shell: { flex: 1, width: '100%', maxWidth: 860, alignSelf: 'center', paddingHorizontal: 22 },
  header: { paddingTop: 19, paddingBottom: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: palette.text, fontSize: 23, letterSpacing: -0.9, fontWeight: '700' },
  sessionTag: { color: palette.muted, fontSize: 8, letterSpacing: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22 },
  title: { color: palette.text, fontSize: 29, letterSpacing: -0.9, fontWeight: '600' },
  subtitle: { color: palette.muted, fontSize: 11, marginTop: 7 },
  count: { borderRadius: 10, borderWidth: 1, borderColor: '#3E5130', padding: 12, backgroundColor: palette.softLime },
  countText: { color: palette.lime, fontFamily: mono, fontSize: 19 },
  sessionNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 16 },
  sessionText: { color: palette.muted, fontSize: 11, lineHeight: 17, flex: 1 },
  empty: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 55 },
  emptyIcon: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#202B1B', marginBottom: 22 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '600' },
  emptyText: { color: palette.muted, fontSize: 12, lineHeight: 20, textAlign: 'center', maxWidth: 300, marginTop: 10 },
});
