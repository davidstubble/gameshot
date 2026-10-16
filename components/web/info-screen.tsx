import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { ActionButton, CropMark, palette } from '@/components/crop/ui';
import { PUBLIC_SITE } from '@/shared/public-site';

export type InfoSection = { title: string; text: string };
export function PolicyLinks() {
  return <View style={styles.links}>
    <Link href="/privacy" style={styles.link}>Privacy</Link>
    <Link href="/terms" style={styles.link}>Terms</Link>
    <Link href="/support" style={styles.link}>Support</Link>
  </View>;
}
export function IdeaSuggestionForm() {
  const [idea, setIdea] = useState('');
  const [audience, setAudience] = useState('');
  const [platform, setPlatform] = useState('Web or mobile');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const options = ['Web or mobile', 'Desktop', 'AI agent', 'Other'];
  function submit() {
    if (!idea.trim() || !PUBLIC_SITE.supportEmail) return;
    const body = [`Idea:\n${idea.trim()}`, `Who it helps:\n${audience.trim() || 'Not specified'}`, `Target:\n${platform}`, `Reply email:\n${email.trim() || 'Not provided'}`].join('\n\n');
    setSent(true);
    void Linking.openURL(`mailto:${PUBLIC_SITE.supportEmail}?subject=${encodeURIComponent('New GameShot LABS app or agent idea')}&body=${encodeURIComponent(body)}`);
  }
  return <View style={styles.ideaBox}>
    <Text role="heading" aria-level={2} style={styles.sectionTitle}>Suggest an app or agent</Text>
    <Text style={styles.copy}>Have a recurring need that deserves a focused tool? Send the idea to GameShot LABS. Patreon supporters in the <Text style={{ color: palette.lime }}>{PUBLIC_SITE.patreonSuggestionTier}</Text> tier get a dedicated place to suggest ideas; I’ll review requests and try my best to build the strongest ones. Please do not attach private images, passwords, or sensitive data.</Text>
    {PUBLIC_SITE.patreonUrl ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(PUBLIC_SITE.patreonUrl!)} style={styles.patreonLink}><Text style={styles.patreonLinkText}>View the {PUBLIC_SITE.patreonSuggestionTier} Patreon tier →</Text></Pressable> : <Text style={styles.email}>The Patreon tier link will appear here after the public profile URL is configured.</Text>}
    <TextInput accessibilityLabel="App or agent idea" value={idea} onChangeText={setIdea} placeholder="What should it do?" placeholderTextColor="#69746B" multiline numberOfLines={4} style={[styles.input, styles.textArea]} />
    <TextInput accessibilityLabel="Who the idea helps" value={audience} onChangeText={setAudience} placeholder="Who would use it?" placeholderTextColor="#69746B" style={styles.input} />
    <Text style={styles.fieldLabel}>Best fit</Text>
    <View style={styles.chips}>{options.map((item) => <Pressable key={item} onPress={() => setPlatform(item)} style={[styles.chip, platform === item && styles.chipActive]}><Text style={[styles.chipText, platform === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>
    <TextInput accessibilityLabel="Optional reply email" value={email} onChangeText={setEmail} placeholder="Optional reply email" placeholderTextColor="#69746B" keyboardType="email-address" autoCapitalize="none" style={styles.input} />
    <ActionButton title={sent ? 'Draft opened — send when ready' : 'Suggest this idea'} icon="paper-plane-outline" onPress={submit} disabled={!idea.trim()} />
    <Text style={styles.email}>Your device’s email app opens a draft addressed to {PUBLIC_SITE.supportEmail}. GameShot does not collect this form in the background.</Text>
  </View>;
}
export function InfoScreen({ title, intro, sections, contact = false, suggestions = false }: {
  title: string; intro: string; sections: InfoSection[]; contact?: boolean; suggestions?: boolean;
}) {
  const router = useRouter();
  const email = PUBLIC_SITE.supportEmail;
  return <ScreenContainer style={{ backgroundColor: palette.bg }}>
    <ScrollView contentContainerStyle={styles.shell}>
      <Pressable accessibilityLabel="Return to crop studio" onPress={() => router.push('/(tabs)')} style={styles.brandRow}>
        <CropMark size={27} /><Text style={styles.brand}>GameShot<Text style={{ color: palette.lime }}>.</Text></Text>
      </Pressable>
      <Text style={styles.eyebrow}>{PUBLIC_SITE.publisher.toUpperCase()}</Text>
      <Text role="heading" aria-level={1} style={styles.title}>{title}</Text>
      <Text style={styles.intro}>{intro}</Text>
      {sections.map((section) => <View key={section.title} style={styles.section}>
        <Text role="heading" aria-level={2} style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.copy}>{section.text}</Text>
      </View>)}
      {contact && email ? <View style={styles.section}>
        <ActionButton title="Email GameShot support" icon="mail-outline" onPress={() => void Linking.openURL(`mailto:${email}?subject=GameShot%20support`)} />
        <Text style={styles.email}>{email}</Text>
      </View> : null}
      {suggestions ? <IdeaSuggestionForm /> : null}
      <PolicyLinks />
      <Text style={styles.foot}>GameShot Apps · Updated October 14, 2026</Text>
    </ScrollView>
  </ScreenContainer>;
}
const styles = StyleSheet.create({
  shell: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 24, paddingBottom: 40 },
  brandRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 35, alignSelf: 'flex-start' },
  brand: { color: palette.text, fontSize: 23, fontWeight: '700' },
  eyebrow: { color: palette.lime, fontSize: 10, letterSpacing: 1.5, marginBottom: 10 },
  title: { color: palette.text, fontSize: 32, fontWeight: '600', letterSpacing: -0.8 },
  intro: { color: palette.muted, fontSize: 14, lineHeight: 23, marginTop: 14, marginBottom: 22 },
  section: { paddingVertical: 20, borderTopWidth: 1, borderTopColor: palette.line },
  sectionTitle: { color: palette.text, fontSize: 17, fontWeight: '600', marginBottom: 10 },
  copy: { color: '#C5CDC8', fontSize: 13, lineHeight: 23 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 22, paddingVertical: 22 },
  link: { color: palette.lime, fontSize: 11, paddingVertical: 8 },
  email: { color: palette.muted, fontSize: 11, textAlign: 'center', marginTop: 12 },
  ideaBox: { paddingVertical: 22, borderTopWidth: 1, borderTopColor: palette.line }, patreonLink: { paddingVertical: 10 }, patreonLinkText: { color: palette.lime, fontSize: 11, fontWeight: '600' }, input: { borderWidth: 1, borderColor: palette.line, borderRadius: 10, color: palette.text, backgroundColor: palette.panel, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13, marginTop: 10 }, textArea: { minHeight: 100, textAlignVertical: 'top' }, fieldLabel: { color: palette.muted, fontSize: 10, marginTop: 16, marginBottom: 7 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { borderWidth: 1, borderColor: palette.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 }, chipActive: { backgroundColor: palette.lime, borderColor: palette.lime }, chipText: { color: palette.muted, fontSize: 10 }, chipTextActive: { color: palette.bg, fontWeight: '700' },
  foot: { color: palette.muted, fontSize: 10, textAlign: 'center' },
});
