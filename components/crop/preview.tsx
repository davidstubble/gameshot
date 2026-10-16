import React, { useEffect, useRef, useState } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { clamp, dragCrop, getCropRect, tryCropRect } from '@/lib/crop/geometry';
import type { CropRect, CropSettings, SourceImage } from '@/lib/crop/types';
import { CropMark, Icon, mono, palette } from './ui';

type Props = { source?: SourceImage; settings: CropSettings; onChange: (patch: Partial<CropSettings>) => void; onPick: () => void; disabled?: boolean; large?: boolean };
type GestureStart = { source: SourceImage; settings: CropSettings; rect: CropRect; factor: number };
export function CropPreview(props: Props) {
  const [width, setWidth] = useState(0);
  const height = props.large ? 360 : 240;
  const result = props.source ? tryCropRect(props.source, props.settings) : { rect: null, error: null };
  const factor = props.source && width ? Math.min(width / props.source.width, height / props.source.height) : 1;
  const displayWidth = props.source ? props.source.width * factor : width;
  const displayHeight = props.source ? props.source.height * factor : height;
  const offsetX = (width - displayWidth) / 2, offsetY = (height - displayHeight) / 2;
  const latest = useRef({ props, rect: result.rect, factor });
  useEffect(() => { latest.current = { props, rect: result.rect, factor }; }, [props, result.rect, factor]);
  const start = useRef<GestureStart | null>(null);
  function begin() {
    const { props: p, rect, factor: f } = latest.current;
    start.current = p.source && rect ? { source: p.source, settings: { ...p.settings }, rect, factor: f } : null;
  }
  const canDrag = () => !!latest.current.rect && !latest.current.props.disabled && latest.current.props.settings.mode !== 'preset';
  // PanResponder only registers these callbacks; ref reads happen later in pointer/touch events.
  // eslint-disable-next-line react-hooks/refs
  const [drag] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: canDrag,
    onMoveShouldSetPanResponder: canDrag,
    onPanResponderGrant: begin,
    onPanResponderMove: (_event, gesture) => {
      const initial = start.current;
      if (initial) latest.current.props.onChange(dragCrop(initial.source, initial.settings, initial.rect, gesture.dx / initial.factor, gesture.dy / initial.factor));
    },
    onPanResponderTerminationRequest: () => false,
  }));
  // Same event-only ref access as the drag handler; no ref value is rendered.
  // eslint-disable-next-line react-hooks/refs
  const [resize] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => canDrag() && latest.current.props.settings.mode === 'ratio',
    onMoveShouldSetPanResponder: () => canDrag() && latest.current.props.settings.mode === 'ratio',
    onPanResponderGrant: begin,
    onPanResponderMove: (_event, gesture) => {
      const initial = start.current;
      if (!initial) return;
      const maximum = getCropRect(initial.source, { ...initial.settings, scale: 1 });
      const horizontal = gesture.dx / initial.factor;
      const vertical = gesture.dy / initial.factor * (initial.rect.width / initial.rect.height);
      const change = Math.abs(horizontal) >= Math.abs(vertical) ? horizontal : vertical;
      const scale = clamp((initial.rect.width + change) / maximum.width, 0.1, 1);
      const updated = getCropRect(initial.source, { ...initial.settings, scale });
      const x = Math.min(initial.rect.x, initial.source.width - updated.width);
      const y = Math.min(initial.rect.y, initial.source.height - updated.height);
      latest.current.props.onChange({ scale,
        anchorX: initial.source.width === updated.width ? 0.5 : x / (initial.source.width - updated.width),
        anchorY: initial.source.height === updated.height ? 0.5 : y / (initial.source.height - updated.height),
      });
    },
    onPanResponderTerminationRequest: () => false,
  }));
  const rect = result.rect;
  const left = rect ? offsetX + rect.x * factor : 0, top = rect ? offsetY + rect.y * factor : 0;
  const cropWidth = rect ? rect.width * factor : 0, cropHeight = rect ? rect.height * factor : 0;
  const shade = 'rgba(0,0,0,0.58)';
  return <View>
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.stage, { height }]}>
      {!props.source ? <Pressable onPress={props.onPick} disabled={props.disabled} accessibilityLabel="Add screenshots to preview" style={styles.empty}>
        <View style={styles.emptyMark}><CropMark size={48} /></View>
        <Text style={styles.emptyTitle}>Your shot. Just the good part.</Text>
        <Text style={styles.emptySubtitle}>Add screenshots to preview your crop.</Text>
        <View style={styles.emptyHint}><Icon name="add" size={14} color={palette.lime} /><Text style={styles.emptyHintText}>CHOOSE IMAGES</Text></View>
      </Pressable> : <>
        <Image source={{ uri: props.source.uri }} resizeMode="contain" style={{ position: 'absolute', width: displayWidth, height: displayHeight, left: offsetX, top: offsetY }} />
        {rect ? <>
          <View pointerEvents="none" style={{ position: 'absolute', left: offsetX, top: offsetY, width: displayWidth, height: rect.y * factor, backgroundColor: shade }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: offsetX, top: top + cropHeight, width: displayWidth, height: Math.max(0, displayHeight - (rect.y + rect.height) * factor), backgroundColor: shade }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: offsetX, top, width: rect.x * factor, height: cropHeight, backgroundColor: shade }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: left + cropWidth, top, width: Math.max(0, displayWidth - (rect.x + rect.width) * factor), height: cropHeight, backgroundColor: shade }} />
          <View {...drag.panHandlers} style={{ position: 'absolute', left, top, width: cropWidth, height: cropHeight, borderWidth: 1.5, borderColor: palette.lime }}>
            {[1, 2].map((i) => <React.Fragment key={i}>
              <View pointerEvents="none" style={{ position: 'absolute', left: `${i * 100 / 3}%`, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(197,247,111,0.22)' }} />
              <View pointerEvents="none" style={{ position: 'absolute', top: `${i * 100 / 3}%`, left: 0, right: 0, height: 1, backgroundColor: 'rgba(197,247,111,0.22)' }} />
            </React.Fragment>)}
            {props.settings.mode === 'preset' ? <View style={styles.lock}><Icon name="lock-closed" size={12} color={palette.bg} /></View> : null}
            {props.settings.mode === 'ratio' && !props.disabled ? <View {...resize.panHandlers} style={styles.handle}><Icon name="resize-outline" size={19} color={palette.bg} /></View> : null}
          </View>
        </> : <View style={styles.invalidBadge}><Icon name="warning-outline" color={palette.error} size={16} /><Text style={styles.invalidText}>Crop doesn’t fit this image</Text></View>}
      </>}
      <View pointerEvents="none" style={styles.stageTag}><View style={styles.dot} /><Text style={styles.tagText}>LIVE PREVIEW</Text></View>
    </View>
    <View style={styles.footer}>
      <Text style={styles.dimensions}>{props.source ? `${props.source.width} × ${props.source.height} px` : 'NO IMAGE SELECTED'}</Text>
      <Text style={styles.help}>{props.settings.mode === 'preset' ? 'Preset locked' : props.settings.mode === 'ratio' ? 'Drag box · resize corner' : 'Drag to position'}</Text>
    </View>
    {result.error ? <Text style={styles.error}>{result.error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  stage: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#090B0C', borderColor: palette.line, borderWidth: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyMark: { marginBottom: 23, opacity: 0.8 },
  emptyTitle: { color: palette.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptySubtitle: { color: palette.muted, fontSize: 12, marginTop: 8, textAlign: 'center' },
  emptyHint: { flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 20 },
  emptyHintText: { color: palette.lime, fontSize: 10, letterSpacing: 1.2, fontWeight: '600' },
  stageTag: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 5, backgroundColor: 'rgba(12,15,14,0.8)' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.lime },
  tagText: { color: '#D0D5CD', fontFamily: mono, fontSize: 8, letterSpacing: 1 },
  lock: { position: 'absolute', top: 5, right: 5, backgroundColor: palette.lime, borderRadius: 4, padding: 4 },
  handle: { position: 'absolute', right: -16, bottom: -16, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: palette.lime },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 6 },
  dimensions: { color: palette.muted, fontSize: 10, fontFamily: mono },
  help: { color: '#7E8882', fontSize: 10 },
  error: { color: palette.error, fontSize: 11, lineHeight: 17, marginTop: 8 },
  invalidBadge: { position: 'absolute', bottom: 14, left: 14, right: 14, flexDirection: 'row', gap: 7, alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: 'rgba(31,20,17,0.9)' },
  invalidText: { color: palette.error, fontSize: 11 },
});
