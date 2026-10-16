import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CropMode, CropSettings } from '@/lib/crop/types';
import { Icon, mono, palette } from './ui';

export function NumberField({ label, value, onChange, disabled = false, decimal = false, suffix }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean; decimal?: boolean; suffix?: string;
}) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={[styles.inputWrap, disabled && { opacity: 0.6 }]}>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'} selectTextOnFocus maxLength={10}
        style={styles.input} placeholderTextColor={palette.muted} />
      {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
    </View>
  </View>;
}
const modes: { mode: CropMode; label: string }[] = [
  { mode: 'preset', label: 'Pro preset' }, { mode: 'pixels', label: 'Pixels' }, { mode: 'ratio', label: 'Aspect ratio' },
];
export function CropControls({ settings, onChange, disabled }: { settings: CropSettings; onChange: (patch: Partial<CropSettings>) => void; disabled: boolean }) {
  return <View style={{ gap: 19 }}>
    <View style={styles.modeBar}>
      {modes.map(({ mode, label }) => <Pressable key={mode} accessibilityRole="button" accessibilityLabel={`${label} crop mode`}
        accessibilityState={{ selected: settings.mode === mode, disabled }} onPress={() => onChange({ mode })} disabled={disabled}
        style={[styles.mode, settings.mode === mode && styles.activeMode]}>
        <Text style={[styles.modeText, settings.mode === mode && { color: palette.text }]}>{label}</Text>
      </Pressable>)}
    </View>
    {settings.mode === 'preset' ? <View style={styles.preset}>
      <View style={styles.presetHeading}>
        <View style={styles.presetIcon}><Icon name="scan-outline" color={palette.lime} size={22} /></View>
        <View style={{ flex: 1 }}><Text style={styles.presetTitle}>GameShot original</Text><Text style={styles.presetSubtitle}>One template. Every screenshot.</Text></View>
        <View style={styles.badge}><Icon name="lock-closed" size={9} color={palette.lime} /><Text style={styles.badgeText}>LOCKED</Text></View>
      </View>
      <View style={styles.presetValues}>
        <View style={{ flex: 1 }}><Text style={styles.meta}>OUTPUT SIZE</Text><Text style={styles.presetSize}>3350 <Text style={{ color: palette.muted }}>×</Text> 1700<Text style={styles.unit}> px</Text></Text></View>
        <View style={styles.divider} />
        <View><Text style={styles.meta}>POSITION</Text><Text style={styles.position}>X 1488  ·  Y 570</Text></View>
      </View>
      <Text style={styles.footnote}>Fixed source pixels. Images must be at least 4838 × 2270 px.</Text>
    </View> : settings.mode === 'pixels' ? <>
      <View style={styles.fieldsRow}>
        <NumberField label="Width" value={settings.width} onChange={(width) => onChange({ width })} disabled={disabled} suffix="px" />
        <Text style={styles.operator}>×</Text>
        <NumberField label="Height" value={settings.height} onChange={(height) => onChange({ height })} disabled={disabled} suffix="px" />
      </View>
      <View style={styles.fieldsRow}>
        <NumberField label="X offset" value={settings.x} onChange={(x) => onChange({ x, centered: false })} disabled={disabled || settings.centered} suffix="px" />
        <View style={{ width: 12 }} />
        <NumberField label="Y offset" value={settings.y} onChange={(y) => onChange({ y, centered: false })} disabled={disabled || settings.centered} suffix="px" />
      </View>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: settings.centered }} accessibilityLabel="Center crop on each image"
        onPress={() => onChange({ centered: !settings.centered })} disabled={disabled} style={styles.checkboxRow}>
        <View style={[styles.checkbox, settings.centered && { backgroundColor: palette.lime, borderColor: palette.lime }]}>{settings.centered ? <Icon name="checkmark" size={13} color={palette.bg} /> : null}</View>
        <Text style={styles.checkLabel}>Center crop on each image</Text>
      </Pressable>
      <Text style={styles.footnote}>Exact size, no stretching. Drag the preview to adjust offsets.</Text>
    </> : <>
      <View style={styles.ratioChips}>
        {['16:9', '9:16', '1:1', '4:3', '3:2'].map((ratio) => {
          const [w, h] = ratio.split(':');
          const active = settings.ratioWidth === w && settings.ratioHeight === h;
          return <Pressable key={ratio} accessibilityLabel={`${ratio} aspect ratio`} accessibilityState={{ selected: active }} disabled={disabled}
            onPress={() => onChange({ ratioWidth: w, ratioHeight: h, scale: 1, anchorX: 0.5, anchorY: 0.5 })}
            style={[styles.ratioChip, active && styles.activeChip]}><Text style={[styles.ratioText, active && { color: palette.lime }]}>{ratio}</Text></Pressable>;
        })}
      </View>
      <View style={styles.fieldsRow}>
        <NumberField label="Ratio width" value={settings.ratioWidth} onChange={(ratioWidth) => onChange({ ratioWidth, scale: 1 })} disabled={disabled} decimal />
        <Text style={styles.operator}>:</Text>
        <NumberField label="Ratio height" value={settings.ratioHeight} onChange={(ratioHeight) => onChange({ ratioHeight, scale: 1 })} disabled={disabled} decimal />
      </View>
      <View style={styles.scaleRow}>
        <Text style={styles.checkLabel}>Crop size <Text style={{ color: palette.lime, fontFamily: mono }}>{Math.round(settings.scale * 100)}%</Text></Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable disabled={disabled || settings.scale <= 0.1} onPress={() => onChange({ scale: Math.max(0.1, settings.scale - 0.1) })} accessibilityLabel="Shrink crop" style={styles.smallButton}><Icon name="remove" size={17} color={palette.text} /></Pressable>
          <Pressable disabled={disabled || settings.scale >= 1} onPress={() => onChange({ scale: Math.min(1, settings.scale + 0.1) })} accessibilityLabel="Enlarge crop" style={styles.smallButton}><Icon name="add" size={17} color={palette.text} /></Pressable>
          <Pressable disabled={disabled} onPress={() => onChange({ scale: 1, anchorX: 0.5, anchorY: 0.5 })} accessibilityLabel="Reset ratio crop" style={styles.smallButton}><Icon name="refresh" size={15} color={palette.text} /></Pressable>
        </View>
      </View>
      <Text style={styles.footnote}>Keeps the ratio, not a fixed output size. Pixel rounding may vary by 1 px.</Text>
    </>}
    <View style={styles.formatRow}>
      <View><Text style={styles.formatTitle}>Export format</Text><Text style={styles.footnote}>{settings.format === 'png' ? 'Lossless, ideal for screenshots' : 'Smaller files, 95% quality'}</Text></View>
      <View style={styles.formatTabs}>{(['png', 'jpeg'] as const).map((format) => <Pressable key={format} disabled={disabled} onPress={() => onChange({ format })} accessibilityLabel={`Export ${format.toUpperCase()}`} accessibilityState={{ selected: settings.format === format }} style={[styles.formatButton, settings.format === format && { backgroundColor: palette.raised }]}><Text style={{ color: settings.format === format ? palette.text : palette.muted, fontSize: 11, fontWeight: '600' }}>{format === 'jpeg' ? 'JPG' : 'PNG'}</Text></Pressable>)}</View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  modeBar: { flexDirection: 'row', backgroundColor: '#111415', borderRadius: 11, padding: 4, borderWidth: 1, borderColor: palette.line },
  mode: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  activeMode: { backgroundColor: palette.raised, borderWidth: 1, borderColor: '#414A3D' },
  modeText: { fontSize: 12, color: palette.muted, fontWeight: '600' },
  preset: { backgroundColor: '#1D2420', borderWidth: 1, borderColor: '#36452E', borderRadius: 12, padding: 16 },
  presetHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  presetIcon: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#283522' },
  presetTitle: { color: palette.text, fontSize: 13, fontWeight: '600' },
  presetSubtitle: { color: palette.muted, fontSize: 10, marginTop: 3 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#293721', padding: 5, borderRadius: 4 },
  badgeText: { color: palette.lime, fontSize: 8, letterSpacing: 0.5 },
  presetValues: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 14 },
  meta: { color: '#869482', fontFamily: mono, fontSize: 8, letterSpacing: 1.1, marginBottom: 7 },
  presetSize: { color: palette.text, fontFamily: mono, fontSize: 17 },
  unit: { color: palette.muted, fontSize: 10 },
  position: { color: palette.text, fontFamily: mono, fontSize: 10 },
  divider: { width: 1, height: 31, backgroundColor: '#364231' },
  footnote: { color: palette.muted, fontSize: 10, lineHeight: 16 },
  fieldsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  field: { flex: 1 },
  fieldLabel: { color: palette.muted, fontSize: 11, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 9, paddingHorizontal: 12, backgroundColor: '#131617' },
  input: { flex: 1, color: palette.text, fontSize: 16, fontFamily: mono, paddingVertical: 12, minHeight: 46 },
  suffix: { color: '#727D74', fontFamily: mono, fontSize: 10 },
  operator: { color: palette.muted, marginTop: 22, width: 12, textAlign: 'center' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 36 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#64705E', alignItems: 'center', justifyContent: 'center' },
  checkLabel: { fontSize: 11, color: palette.muted },
  ratioChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  ratioChip: { flex: 1, minWidth: 48, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#16191A', borderWidth: 1, borderColor: palette.line },
  activeChip: { borderColor: '#65813C', backgroundColor: palette.softLime },
  ratioText: { fontSize: 11, fontFamily: mono, color: palette.muted },
  scaleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 8 },
  formatRow: { paddingTop: 19, borderTopWidth: 1, borderTopColor: palette.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  formatTitle: { color: palette.text, fontSize: 12, marginBottom: 3 },
  formatTabs: { flexDirection: 'row', borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 3 },
  formatButton: { paddingHorizontal: 10, minHeight: 36, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
});
