import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton, Icon, Notice, palette } from '@/components/crop/ui';
import { StudioScreen, studioStyles } from '@/components/studio/ui';

type Phase = 'ready' | 'queued' | 'revealing' | 'result';
type Outcome = { label: string; detail: string; color: string; returnCredits: number };
type RoomEvent = { id: number; text: string; tone: 'muted' | 'lime' | 'gold' };

const OUTCOMES: Outcome[] = [
  { label: 'Warm connection', detail: 'A steady handoff keeps the room moving.', color: palette.lime, returnCredits: 25 },
  { label: 'Streak spark', detail: 'A rare cosmetic badge is added to your local collection.', color: '#8FE7D0', returnCredits: 40 },
  { label: 'Room favorite', detail: 'The room noticed your timing and the energy jumps.', color: '#E7C77E', returnCredits: 75 },
  { label: 'Full circle', detail: 'The virtual gift returns to your wallet for another round.', color: '#BDA7FF', returnCredits: 99 },
];

export default function GiftRushScreen() {
  const [credits, setCredits] = useState(100);
  const [gift, setGift] = useState(25);
  const [queue, setQueue] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [revealMeter, setRevealMeter] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [roomEvents, setRoomEvents] = useState<RoomEvent[]>([
    { id: 1, text: 'Nova joined the room', tone: 'muted' },
    { id: 2, text: 'Room is warming up', tone: 'lime' },
  ]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventId = useRef(3);

  useEffect(() => {
    const activity = setInterval(() => {
      const names = ['PixelFox', 'ArcadeMoth', 'ClipWizard', 'NeonJade'];
      const name = names[Math.floor(Math.random() * names.length)];
      const next: RoomEvent = { id: eventId.current++, text: `${name} is watching the reveal`, tone: 'muted' };
      setRoomEvents((events) => [...events.slice(-3), next]);
    }, 4200);
    return () => { clearInterval(activity); if (timer.current) clearTimeout(timer.current); };
  }, []);

  useEffect(() => {
    if (phase !== 'revealing') return;
    let value = 8;
    const spin = setInterval(() => {
      value = Math.min(92, value + Math.floor(Math.random() * 19) + 7);
      setRevealMeter(value);
    }, 120);
    return () => clearInterval(spin);
  }, [phase]);

  const progressLabel = useMemo(() => {
    if (phase === 'queued') return 'Finding the next connection…';
    if (phase === 'revealing') return 'The room is revealing your result…';
    if (phase === 'result') return 'Round complete';
    return 'Ready for a virtual round';
  }, [phase]);

  function pushRoomEvent(text: string, tone: RoomEvent['tone'] = 'muted') {
    setRoomEvents((events) => [...events.slice(-3), { id: eventId.current++, text, tone }]);
  }

  function startRound() {
    if (phase !== 'ready' || gift > credits) return;
    setNotice(null);
    setCredits((value) => value - gift);
    setRevealMeter(0);
    setQueue((value) => value + 1);
    setOutcome(null);
    pushRoomEvent(`You queued a ${gift}-credit gift`, 'lime');
    setPhase('queued');
    timer.current = setTimeout(() => {
      setPhase('revealing');
      setRevealMeter(8);
      pushRoomEvent('The reveal wheel is spinning', 'gold');
      timer.current = setTimeout(() => {
        const next = OUTCOMES[Math.floor(Math.random() * OUTCOMES.length)];
        setOutcome(next);
        setCredits((value) => value + next.returnCredits);
        setQueue((value) => Math.max(0, value - 1));
        setStreak((value) => value + 1);
        setRevealMeter(100);
        pushRoomEvent(`You hit ${next.label.toLowerCase()}`, 'gold');
        setPhase('result');
      }, 950);
    }, 650);
  }

  function resetRound() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPhase('ready');
    setRevealMeter(0);
    setOutcome(null);
    setNotice(null);
    pushRoomEvent('Round reset · room is ready', 'lime');
  }

  function chooseGift(value: number) {
    if (phase !== 'ready') return;
    setGift(Math.min(value, Math.max(1, credits)));
  }

  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    pushRoomEvent(`You: ${text.slice(0, 60)}`, 'lime');
    setChatInput('');
  }

  return <StudioScreen title="Gift Rush" subtitle="A fast social reveal game prototype for the GameShot LABS lineup.">
    <View style={styles.hero}>
      <View style={{ flex: 1, gap: 10 }}>
        <Text style={studioStyles.label}>PLAY-MONEY PROTOTYPE</Text>
        <Text style={styles.heroTitle}>Queue a gift.<Text style={{ color: palette.lime }}> Feel the reveal.</Text></Text>
        <Text style={studioStyles.copy}>Connect with a simulated room, talk with the room, trigger a rapid reveal, and build a local streak. This prototype uses virtual credits only.</Text>
      </View>
      <View style={styles.wallet}><Text style={styles.walletLabel}>VIRTUAL WALLET</Text><Text style={styles.walletValue}>{credits}</Text><Text style={styles.walletNote}>credits · no cash value</Text></View>
    </View>

    <View style={styles.statsRow}>
      <View style={styles.stat}><Text style={styles.statLabel}>ROOM ENERGY</Text><Text style={styles.statValue}>{queue ? 'RISING' : 'LIVE'}</Text><Text style={styles.statMeta}>12 watchers</Text></View>
      <View style={styles.stat}><Text style={styles.statLabel}>YOUR STREAK</Text><Text style={styles.statValue}>{streak ? `${streak}×` : '—'}</Text><Text style={styles.statMeta}>local rounds</Text></View>
      <View style={styles.stat}><Text style={styles.statLabel}>NEXT REVEAL</Text><Text style={styles.statValue}>{phase === 'ready' ? 'OPEN' : phase === 'result' ? 'DONE' : 'NOW'}</Text><Text style={styles.statMeta}>virtual room</Text></View>
    </View>

    <View style={styles.notice}><Icon name="shield-checkmark-outline" color={palette.lime} size={16} /><Text style={styles.noticeText}>No Apple Cash, deposits, withdrawals, prizes, or real-money wagering are connected.</Text></View>

    <View style={styles.roomPanel}>
      <View style={styles.sectionHeader}><View style={styles.roomTitleRow}><View style={styles.liveDot} /><Text style={studioStyles.label}>ROOM ACTIVITY</Text></View><Text style={styles.queueLabel}>LIVE SIMULATION</Text></View>
      {roomEvents.slice(-4).map((event) => <View key={event.id} style={styles.activityRow}><Icon name={event.tone === 'gold' ? 'sparkles-outline' : 'radio-outline'} size={14} color={event.tone === 'gold' ? '#E7C77E' : event.tone === 'lime' ? palette.lime : palette.muted} /><Text style={[styles.activityText, event.tone === 'gold' && { color: '#E7C77E' }]}>{event.text}</Text><Text style={styles.activityTime}>now</Text></View>)}
      <View style={styles.chatRow}><TextInput accessibilityLabel="Room chat message" value={chatInput} onChangeText={setChatInput} onSubmitEditing={sendChat} placeholder="Say something to the room…" placeholderTextColor={palette.muted} maxLength={80} style={styles.chatInput} editable={phase !== 'queued' && phase !== 'revealing'} /><Pressable accessibilityRole="button" accessibilityLabel="Send room chat message" disabled={!chatInput.trim()} onPress={sendChat} style={[styles.sendButton, !chatInput.trim() && { opacity: 0.35 }]}><Icon name="send" size={16} color={palette.bg} /></Pressable></View>
    </View>

    <View style={styles.panel}>
      <View style={styles.sectionHeader}><Text style={studioStyles.label}>01 / SET YOUR ROUND</Text><Text style={styles.queueLabel}>{queue ? `${queue} in queue` : 'room open'}</Text></View>
      <Text style={styles.sectionTitle}>Choose a virtual gift</Text>
      <View style={styles.chips}>{[5, 25, 50, 99].map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: gift === value, disabled: phase !== 'ready' || value > credits }} disabled={phase !== 'ready' || value > credits} onPress={() => chooseGift(value)} style={[styles.chip, gift === value && styles.chipActive, value > credits && { opacity: 0.35 }]}><Text style={[styles.chipText, gift === value && { color: palette.lime }]}>{value}</Text></Pressable>)}</View>
      <Text style={styles.helper}>The selected credits leave your virtual wallet when the round locks. The reveal result is cosmetic and virtual.</Text>
      <ActionButton title={phase === 'ready' ? `Queue ${gift}-credit gift` : progressLabel} icon={phase === 'ready' ? 'flash-outline' : undefined} loading={phase === 'queued' || phase === 'revealing'} disabled={phase !== 'ready' || gift > credits} onPress={startRound} />
    </View>

    <View style={styles.revealPanel}>
      <View style={styles.sectionHeader}><Text style={studioStyles.label}>02 / CONNECTION REVEAL</Text><Text style={styles.roundId}>{phase === 'ready' ? 'WAITING' : phase.toUpperCase()}</Text></View>
      <View style={[styles.revealOrb, phase === 'revealing' && styles.revealOrbActive, phase === 'result' && { borderColor: outcome?.color ?? palette.lime }]}>
        {phase === 'ready' ? <><Icon name="people-outline" color={palette.muted} size={32} /><Text style={styles.orbText}>Your next connection appears here.</Text></> : phase === 'queued' ? <><Icon name="link-outline" color={palette.lime} size={32} /><Text style={styles.orbText}>Connecting to the room…</Text></> : phase === 'revealing' ? <><Text style={styles.percent}>{revealMeter}%</Text><Text style={styles.orbText}>Hold for the reveal</Text></> : <><Text style={[styles.resultLabel, { color: outcome?.color ?? palette.lime }]}>{outcome?.label}</Text><Text style={styles.percent}>{outcome?.returnCredits}</Text><Text style={styles.orbText}>virtual credits returned</Text></>}
      </View>
      {phase !== 'ready' ? <View style={styles.meterTrack}><View style={[styles.meterFill, { width: `${revealMeter}%` }]} /></View> : null}
      {outcome ? <View style={styles.resultCopy}><Text style={styles.sectionTitle}>Round complete</Text><Text style={studioStyles.copy}>{outcome.detail} Your local virtual balance is now {credits} credits.</Text><ActionButton title="Queue another round" icon="arrow-forward" secondary onPress={resetRound} /></View> : null}
      {phase !== 'ready' && !outcome ? <Text style={styles.helper}>{progressLabel}</Text> : null}
    </View>

    {notice ? <Notice message={notice} error onDismiss={() => setNotice(null)} /> : null}
    <View style={styles.footer}><Text style={studioStyles.label}>DESIGNED FOR LATER REVIEW</Text><Text style={studioStyles.copy}>A real-money version would be a separate regulated product. Before any cash feature, it would need legal, licensing, payment-provider, age, geographic, randomness, and responsible-gaming approval.</Text></View>
  </StudioScreen>;
}

const styles = StyleSheet.create({
  hero: { marginTop: 22, padding: 22, borderRadius: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panel, flexDirection: 'row', gap: 18 },
  heroTitle: { color: palette.text, fontSize: 31, lineHeight: 35, fontWeight: '600', letterSpacing: -1 },
  wallet: { minWidth: 132, padding: 14, borderRadius: 11, borderWidth: 1, borderColor: '#455B31', backgroundColor: palette.softLime, justifyContent: 'center' },
  walletLabel: { color: palette.muted, fontSize: 8, letterSpacing: 1 }, walletValue: { color: palette.lime, fontSize: 35, fontWeight: '700', marginTop: 5 }, walletNote: { color: palette.muted, fontSize: 9, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 14 }, stat: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.bg }, statLabel: { color: palette.muted, fontSize: 8, letterSpacing: 0.7 }, statValue: { color: palette.lime, fontSize: 17, fontFamily: 'monospace', fontWeight: '700', marginTop: 7 }, statMeta: { color: palette.muted, fontSize: 9, marginTop: 3 },
  notice: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginTop: 14, padding: 13, borderWidth: 1, borderColor: '#35452A', borderRadius: 10, backgroundColor: '#192217' }, noticeText: { color: '#C6D6B7', fontSize: 11, lineHeight: 17, flex: 1 },
  roomPanel: { marginTop: 18, padding: 18, gap: 10, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.bg }, roomTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.lime }, activityRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 25 }, activityText: { color: '#C2C9C3', fontSize: 11, flex: 1 }, activityTime: { color: palette.muted, fontSize: 9 }, chatRow: { flexDirection: 'row', gap: 8, marginTop: 5 }, chatInput: { flex: 1, minHeight: 42, color: palette.text, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, borderRadius: 9, paddingHorizontal: 12, fontSize: 11 }, sendButton: { width: 44, minHeight: 42, borderRadius: 9, backgroundColor: palette.lime, justifyContent: 'center', alignItems: 'center' },
  panel: { marginTop: 18, padding: 20, gap: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panel },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '600' }, queueLabel: { color: palette.muted, fontSize: 10 }, roundId: { color: palette.lime, fontSize: 9, letterSpacing: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, chip: { minWidth: 58, minHeight: 46, paddingHorizontal: 16, borderRadius: 9, borderWidth: 1, borderColor: palette.line, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.bg }, chipActive: { borderColor: palette.lime, backgroundColor: palette.softLime }, chipText: { color: palette.text, fontFamily: 'monospace', fontSize: 13 }, helper: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  revealPanel: { marginTop: 18, padding: 20, gap: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.bg }, revealOrb: { minHeight: 190, borderRadius: 18, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panel, alignItems: 'center', justifyContent: 'center', gap: 9, padding: 20 }, revealOrbActive: { borderColor: palette.lime, backgroundColor: '#202A1A' }, orbText: { color: palette.muted, fontSize: 11, textAlign: 'center' }, percent: { color: palette.lime, fontSize: 44, fontWeight: '700', fontFamily: 'monospace' }, resultLabel: { fontSize: 18, fontWeight: '700' }, resultCopy: { gap: 12 }, meterTrack: { height: 7, borderRadius: 4, backgroundColor: palette.raised, overflow: 'hidden' }, meterFill: { height: 7, borderRadius: 4, backgroundColor: palette.lime },
  footer: { marginTop: 22, paddingTop: 20, borderTopWidth: 1, borderTopColor: palette.line, gap: 9 },
});
