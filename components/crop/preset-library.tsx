import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton, Icon, mono, palette } from './ui';
import { confirmAction } from '@/lib/confirm';
import { createPreset, describePreset, PRESET_LIMIT, PRESET_NAME_MAX, upsertPreset, type SavedPreset } from '@/lib/crop/preset-rules';
import { loadPresets, storePresets } from '@/lib/crop/presets-storage';
import type { CropSettings } from '@/lib/crop/types';

type Props = { settings: CropSettings; onApply: (settings: Partial<CropSettings>) => void; disabled: boolean; isPro: boolean; onUnlock: () => void };

const SAME_KEYS = ['mode', 'width', 'height', 'x', 'y', 'centered', 'ratioWidth', 'ratioHeight', 'format'] as const;
const matches = (preset: SavedPreset, settings: CropSettings) =>
  SAME_KEYS.every((key) => preset.settings[key] === settings[key]) &&
  (preset.settings.mode !== 'ratio' || (Math.abs(preset.settings.scale - settings.scale) < 0.001 && Math.abs(preset.settings.anchorX - settings.anchorX) < 0.001 && Math.abs(preset.settings.anchorY - settings.anchorY) < 0.001));

export function PresetLibrary({ settings, onApply, disabled, isPro, onUnlock }: Props) {
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!isPro) return;
    let live = true;
    void loadPresets().then((list) => { if (live) setPresets(list); });
    return () => { live = false; };
  }, [isPro]);

  if (!isPro) return <Pressable accessibilityRole="button" accessibilityLabel="Unlock saved crops with Pro" onPress={onUnlock} style={styles.teaser}>
    <Icon name="bookmarks-outline" size={17} color={palette.lime} />
    <View style={{ flex: 1 }}><Text style={styles.teaserTitle}>Saved crops</Text><Text style={styles.teaserText}>Save this crop for each game and reuse it in one tap.</Text></View>
    <Text style={styles.pro}>PRO</Text>
  </Pressable>;

  async function save() {
    setSaving(true); setMessage(null);
    try {
      const preset = createPreset(name, settings, presets);
      const next = upsertPreset(presets, preset);
      await storePresets(next);
      setPresets(next); setNaming(false); setName('');
      setMessage({ text: `Saved “${preset.name}”. Tap it any time to load this crop.`, error: false });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : 'Could not save this crop.', error: true }); }
    finally { setSaving(false); }
  }
  async function remove(preset: SavedPreset) {
    if (!(await confirmAction('Delete saved crop?', `“${preset.name}” will be removed from this device. Images and exports are not affected.`, 'Delete'))) return;
    const next = presets.filter((item) => item.id !== preset.id);
    try { await storePresets(next); setPresets(next); setMessage(null); }
    catch (error) { setMessage({ text: error instanceof Error ? error.message : 'Could not delete this crop.', error: true }); }
  }

  return <View style={styles.box}>
    <View style={styles.head}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Icon name="bookmarks-outline" size={15} color={palette.lime} /><Text style={styles.title}>Saved crops</Text></View>
      <Text style={styles.count}>{presets.length}/{PRESET_LIMIT}</Text>
    </View>
    {presets.length ? <View style={{ gap: 6 }}>{presets.map((preset) => {
      const active = matches(preset, settings);
      return <View key={preset.id} style={[styles.preset, active && styles.presetActive]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Load saved crop ${preset.name}`} accessibilityState={{ selected: active, disabled }} disabled={disabled}
          onPress={() => { onApply({ ...preset.settings }); setMessage(null); }} style={styles.presetMain}>
          <Text numberOfLines={1} style={[styles.presetName, active && { color: palette.lime }]}>{preset.name}</Text>
          <Text numberOfLines={1} style={styles.presetMeta}>{describePreset(preset)}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete saved crop ${preset.name}`} disabled={disabled} onPress={() => void remove(preset)} style={styles.delete}><Icon name="close" size={16} /></Pressable>
      </View>;
    })}</View> : <Text style={styles.empty}>No saved crops yet. Set up a Pixels or Aspect ratio crop, then save it here.</Text>}
    {settings.mode === 'preset' ? <Text style={styles.empty}>The GameShot original preset is always one tap away. Switch to Pixels or Aspect ratio to save your own.</Text>
      : naming ? <View style={{ gap: 8, marginTop: 10 }}>
        <TextInput value={name} onChangeText={setName} placeholder="Name, e.g. Fortnite killfeed" placeholderTextColor={palette.muted} maxLength={PRESET_NAME_MAX}
          autoFocus accessibilityLabel="Saved crop name" returnKeyType="done" onSubmitEditing={() => void save()} style={styles.input} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ActionButton title="Save crop" icon="checkmark" onPress={() => void save()} loading={saving} disabled={disabled || !name.trim()} style={{ flex: 1, minHeight: 44, paddingVertical: 10 }} />
          <ActionButton title="Cancel" secondary onPress={() => { setNaming(false); setName(''); }} style={{ minHeight: 44, paddingVertical: 10 }} />
        </View>
      </View> : <ActionButton title="Save current crop" icon="bookmark-outline" secondary onPress={() => { setNaming(true); setMessage(null); }} disabled={disabled} style={{ minHeight: 44, paddingVertical: 10, marginTop: 10 }} />}
    {message ? <Text style={[styles.message, message.error && { color: palette.error }]}>{message.text}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  teaser: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, padding: 13, borderRadius: 11, borderWidth: 1, borderColor: '#36452E', backgroundColor: '#1A211B' },
  teaserTitle: { color: palette.text, fontSize: 12, fontWeight: '600' },
  teaserText: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  pro: { color: palette.lime, fontSize: 9, fontFamily: mono, letterSpacing: 1 },
  box: { marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: palette.line },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { color: palette.text, fontSize: 12, fontWeight: '600' },
  count: { color: palette.muted, fontSize: 10, fontFamily: mono },
  preset: { flexDirection: 'row', alignItems: 'center', borderRadius: 9, borderWidth: 1, borderColor: palette.line, backgroundColor: '#151819' },
  presetActive: { borderColor: '#65813C', backgroundColor: palette.softLime },
  presetMain: { flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 7 },
  presetName: { color: palette.text, fontSize: 12, fontWeight: '600' },
  presetMeta: { color: palette.muted, fontSize: 10, fontFamily: mono, marginTop: 3 },
  delete: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 4 },
  input: { borderWidth: 1, borderColor: palette.line, borderRadius: 9, paddingHorizontal: 12, minHeight: 46, color: palette.text, fontSize: 14, backgroundColor: '#131617' },
  message: { color: '#CDDEB6', fontSize: 10, lineHeight: 16, marginTop: 9 },
});
