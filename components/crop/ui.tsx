import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type ColorValue, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const palette = {
  bg: '#101213', panel: '#191C1D', raised: '#222627', line: '#303536',
  text: '#F1F3EB', muted: '#9CA4A0', lime: '#C5F76F', softLime: '#26351C', error: '#FFAD97',
};
export const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, size = 20, color = palette.muted }: { name: IconName; size?: number; color?: ColorValue }) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function CropMark({ size = 32 }: { size?: number }) {
  const length = size * 0.36;
  return <View style={{ width: size, height: size }}>
    {([['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']] as const).map(([vertical, horizontal]) => (
      <View key={`${vertical}${horizontal}`} style={{ position: 'absolute', [vertical]: 0, [horizontal]: 0, width: length, height: length,
        borderColor: palette.lime, [`border${vertical === 'top' ? 'Top' : 'Bottom'}Width`]: 3,
        [`border${horizontal === 'left' ? 'Left' : 'Right'}Width`]: 3 }} />
    ))}
    <View style={{ position: 'absolute', width: 4, height: 4, top: size / 2 - 2, left: size / 2 - 2, backgroundColor: palette.lime }} />
  </View>;
}
export function SectionLabel({ number, title, aside }: { number: string; title: string; aside?: string }) {
  return <View style={ui.sectionRow}>
    <View style={ui.row}><Text style={ui.sectionNumber}>{number}</Text><Text style={ui.sectionTitle}>{title}</Text></View>
    {aside ? <Text style={ui.smallMuted}>{aside}</Text> : null}
  </View>;
}
export function ActionButton({ title, icon, onPress, disabled, loading, secondary = false, style }: {
  title: string; icon?: IconName; onPress: () => void; disabled?: boolean; loading?: boolean; secondary?: boolean; style?: ViewStyle;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled || loading} onPress={onPress}
    style={({ pressed }) => [ui.button, secondary ? ui.secondaryButton : ui.primaryButton, (disabled || loading) && { opacity: 0.4 }, pressed && { opacity: 0.75 }, style]}>
    {loading ? <ActivityIndicator size="small" color={secondary ? palette.lime : palette.bg} /> : icon ? <Icon name={icon} color={secondary ? palette.text : palette.bg} size={19} /> : null}
    <Text style={[ui.buttonText, { color: secondary ? palette.text : palette.bg }]}>{title}</Text>
  </Pressable>;
}
export function Notice({ message, error = false, onDismiss }: { message: string; error?: boolean; onDismiss?: () => void }) {
  return <View style={[ui.notice, error && { borderColor: '#663D30', backgroundColor: '#291F1B' }]}>
    <Icon name={error ? 'alert-circle-outline' : 'information-circle-outline'} color={error ? palette.error : palette.lime} />
    <Text style={[ui.noticeText, error && { color: palette.error }]}>{message}</Text>
    {onDismiss ? <Pressable accessibilityLabel="Dismiss message" onPress={onDismiss} style={{ padding: 5 }}><Icon name="close" size={18} /></Pressable> : null}
  </View>;
}
export const ui = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionNumber: { color: palette.lime, fontSize: 11, fontFamily: mono },
  sectionTitle: { color: palette.text, fontSize: 14, fontWeight: '600' },
  smallMuted: { color: palette.muted, fontSize: 11 },
  button: { minHeight: 50, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryButton: { backgroundColor: palette.lime },
  secondaryButton: { backgroundColor: palette.raised, borderWidth: 1, borderColor: palette.line },
  buttonText: { fontSize: 14, fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, borderWidth: 1, borderColor: '#37462A', borderRadius: 10, backgroundColor: '#1C2518' },
  noticeText: { flex: 1, color: '#CDDEB6', fontSize: 12, lineHeight: 18 },
});
