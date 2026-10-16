import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { ActionButton, CropMark, Icon, mono, Notice, palette } from '@/components/crop/ui';
import { useBilling, PRO_OFFER } from '@/lib/billing/store';
import type { PurchaseHistory } from '@/shared/billing';
import { APPROVED_PRICING_LIST } from '@/shared/pricing';
import { PolicyLinks } from '@/components/web/info-screen';
import { PUBLIC_SITE } from '@/shared/public-site';

function paidAmount(record: PurchaseHistory) {
  if (record.amount === null || !record.currency) return 'Amount unavailable';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: record.currency.toUpperCase() }).format(Number(record.amount)); }
  catch { return `${record.amount} ${record.currency.toUpperCase()}`; }
}
export default function ProScreen() {
  const billing = useBilling();
  const { refresh, confirmCheckout, status } = billing;
  const router = useRouter();
  const params = useLocalSearchParams<{ checkout?: string; session_id?: string }>();
  const confirmed = useRef<string | null>(null);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    if (params.checkout !== 'success' || typeof params.session_id !== 'string' || !status?.user || confirmed.current === params.session_id) return;
    confirmed.current = params.session_id;
    void confirmCheckout(params.session_id);
  }, [params.checkout, params.session_id, status?.user, confirmCheckout]);
  const native = Platform.OS !== 'web';
  const user = billing.status?.user;
  const price = native ? billing.native?.displayPrice || PRO_OFFER.displayPrice : PRO_OFFER.displayPrice;
  const paymentEnvironment = Platform.OS === 'ios'
    ? billing.status?.appleEnvironment ?? billing.status?.environment
    : billing.status?.environment;
  const cancelled = params.checkout === 'cancelled';
  const webUnavailable = !native && billing.status?.webReady === false;
  const paymentReady = native ? billing.native?.ready === true : billing.status?.webReady === true;
  return <ScreenContainer style={{ backgroundColor: palette.bg }}>
    <ScrollView contentContainerStyle={styles.shell} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><CropMark size={27} /><Text style={styles.brand}>GameShot<Text style={{ color: palette.lime }}>.</Text></Text></View>
        <Text style={styles.mode}>{!paymentReady ? 'PURCHASES UNAVAILABLE' : paymentEnvironment === 'live' ? 'SECURE PAYMENTS' : 'TEST PAYMENTS'}</Text></View>
      <Text style={styles.eyebrow}>MORE SHOTS. ONE PURCHASE.</Text>
      <Text role="heading" aria-level={1} style={styles.title}>{billing.isPro ? 'You’re Pro.' : 'Keep the whole batch.'}</Text>
      <Text style={styles.subtitle}>Exact crops. Original order. No monthly bill.</Text>
      {billing.notice ? <View style={styles.notice}><Notice message={billing.notice} error={billing.failed} onDismiss={billing.clearNotice} /></View> : cancelled ? <View style={styles.notice}><Notice message="Checkout cancelled. Pro has not been unlocked and your free access is unchanged." /></View> : null}
      {webUnavailable ? <View style={styles.testNote}><Icon name="lock-closed-outline" size={17} color={palette.lime} /><Text style={styles.testText}>Pro purchasing is temporarily unavailable while live payment setup is completed. Free batches up to 3 images still work.</Text></View> : paymentReady && paymentEnvironment !== 'live' ? <View style={styles.testNote}><Icon name="flask-outline" size={17} color={palette.lime} /><Text style={styles.testText}>{native ? 'App Store sandbox testing. These are not live purchases; access requires the configured testing backend.' : 'Payment testing mode. Test Checkout does not move real money. Live sales require owner activation.'}</Text></View> : null}

      <View style={styles.offer}>
        <View style={styles.offerHeader}><Text style={styles.offerName}>GameShot <Text style={{ color: palette.lime }}>Pro</Text></Text><Text style={styles.lifetime}>ONE-TIME</Text></View>
        <View style={styles.priceRow}><Text style={styles.price}>{price}</Text><View><Text style={styles.priceLabel}>pay once</Text><Text style={styles.priceDetail}>{native && billing.native?.displayPrice ? 'App Store price' : 'USD · lifetime access'}</Text></View></View>
        <View style={styles.rule} />
        {['Larger batches across Crop, Image, and Layout Labs', 'Exact-pixel resize and 95%+ JPEG output for readable text', 'Ordered contact sheets and PDF layouts for print or handoff', 'Saved crops: reuse each game’s crop in one tap', 'Numbered ZIP receipts and transfer-ready filenames', 'Keep batches on this device and reopen them later', 'Original images stay untouched'].map((text) => <View key={text} style={styles.benefit}><Icon name="checkmark" size={17} color={palette.lime} /><Text style={styles.benefitText}>{text}</Text></View>)}
        <Text style={styles.limitNote}>Device limits still apply: 100 MP per image and 128 MB per ZIP. No subscription or automatic renewal.</Text>
        {billing.isPro ? <ActionButton title="Back to crop studio" icon="scan-outline" onPress={() => router.push('/(tabs)')} style={{ marginTop: 20 }} /> : <ActionButton
          title={webUnavailable ? 'Purchases temporarily unavailable' : !user ? 'Sign in to buy Pro' : native ? `Buy with App Store · ${price}` : `Buy Pro · ${PRO_OFFER.displayPrice}`}
          icon={native ? 'logo-apple' : 'card-outline'} loading={billing.busy}
          disabled={billing.loading || webUnavailable || (native && !!user && !billing.native?.ready)} onPress={() => void billing.buy()} style={{ marginTop: 20 }} />}
        {!native ? <Text style={styles.wallets}>Apple Pay appears in secure Checkout on eligible devices and browsers. Cards are also supported.</Text> : !billing.native?.ready ? <Text style={styles.wallets}>{billing.native?.reason || 'App Store buying requires owner setup and a signed native build.'}</Text> : null}
      </View>

      <View style={styles.catalog}><Text style={styles.sectionTitle}>APPROVED STUDIO CATALOG</Text><Text style={styles.catalogIntro}>The studio is moving from one all-in price to fair workflow packs. Planned products remain clearly labeled until their Stripe or Apple product IDs are configured.</Text>{APPROVED_PRICING_LIST.filter((product) => product.key !== 'gameshot-free').map((product) => <View key={product.key} style={styles.catalogRow}><View style={{ flex: 1, gap: 4 }}><Text style={styles.catalogName}>{product.name}</Text><Text style={styles.catalogDescription}>{product.description}</Text><Text style={styles.catalogFeatures}>{product.features.slice(0, 3).join(' · ')}</Text></View><View style={{ alignItems: 'flex-end', gap: 5 }}><Text style={styles.catalogPrice}>{product.displayPrice}</Text><Text style={[styles.catalogStatus, product.availability === 'available' ? { color: palette.lime } : null]}>{product.availability === 'available' ? 'AVAILABLE' : 'PLANNED'}</Text></View></View>)}</View>
      <View style={styles.free}><View style={{ flex: 1 }}><Text style={styles.freeTitle}>Free proves the workflow.</Text><Text style={styles.freeText}>Try up to 3 images per batch with crop, resize, layout, full-screen review, pick-and-reorder, and share or ZIP exports. Buy only the workflow you need, or choose the Studio Bundle when it is configured.</Text></View><Text style={styles.freeCount}>03</Text></View>
      <View style={styles.account}>
        <Text style={styles.sectionTitle}>YOUR ACCESS</Text>
        <Text style={styles.accountName}>{user ? user.name || user.email || 'Signed-in account' : 'Not signed in'}</Text>
        {user?.email ? <Text style={styles.accountMeta}>{user.email}</Text> : null}
        <Text style={styles.accessState}>{billing.loading ? 'Checking verified access…' : billing.status?.isAdmin ? 'ADMIN · PRO UNLOCKED' : billing.isPro ? 'PRO ACTIVE' : 'FREE · 3 IMAGES PER BATCH'}</Text>
        {billing.status?.isAdmin ? <Text style={styles.accountMeta}>Admin account: unlimited batches without a purchase.</Text> : null}
        <View style={{ gap: 9, marginTop: 16 }}><ActionButton title={user ? 'Restore purchases / refresh access' : 'Sign in to restore purchases'} icon="refresh-outline" secondary disabled={billing.busy || billing.loading} onPress={() => void billing.restore()} />
          {user ? <Pressable accessibilityLabel="Sign out" onPress={() => void billing.logout()} style={styles.signOut}><Text style={{ color: palette.muted, fontSize: 11 }}>Sign out</Text></Pressable> : null}</View>
        <Text style={styles.small}>Use the same GameShot account on another device. Pro batches require an internet connection to verify paid access; your image pixels never leave the device.</Text>
      </View>
      <View style={styles.history}>
        <Text style={styles.sectionTitle}>PURCHASE & CHECKOUT HISTORY</Text>
        {!user ? <Text style={styles.empty}>Sign in to see your verified purchase records.</Text> : !billing.status?.history.length ? <Text style={styles.empty}>No purchase records on this account yet.</Text> : billing.status.history.map((record) => <View key={record.id} style={styles.historyRow}>
          <View style={{ flex: 1 }}><Text style={styles.historyTitle}>{record.product}</Text><Text style={styles.accountMeta}>{new Date(record.createdAt).toLocaleDateString()} · {record.provider === 'apple' ? 'App Store' : 'Stripe'} · {record.environment}</Text>
            {record.receiptUrl ? <Pressable onPress={() => void Linking.openURL(record.receiptUrl!)} style={{ paddingTop: 8 }}><Text style={{ color: palette.lime, fontSize: 10 }}>View receipt</Text></Pressable> : null}</View>
          <View style={{ alignItems: 'flex-end' }}><Text style={styles.historyAmount}>{paidAmount(record)}</Text><Text style={[styles.historyStatus, { color: record.status === 'active' ? palette.lime : ['failed', 'refunded', 'revoked'].includes(record.status) ? palette.error : palette.muted }]}>{record.status === 'active' ? 'PAID / ACTIVE' : record.status.toUpperCase()}</Text></View>
        </View>)}
      </View>
      <View style={styles.support}>
        <Text style={styles.sectionTitle}>SUPPORT THE STUDIO</Text>
        <Text style={styles.supportText}>Pro unlocks the larger workflow. If you want to help keep local-first image tools maintained, optional one-time tips and monthly support can live here too. The planned Patreon <Text style={{ color: palette.lime }}>{PUBLIC_SITE.patreonSuggestionTier}</Text> tier includes a dedicated place to suggest app or agent ideas for review.</Text>
        <View style={styles.supportRow}>
          {PUBLIC_SITE.buyMeACoffeeUrl ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(PUBLIC_SITE.buyMeACoffeeUrl!)} style={styles.supportButton}><Text style={styles.supportButtonTitle}>Buy Me a Coffee</Text><Text style={styles.supportButtonMeta}>One-time support</Text></Pressable> : null}
          {PUBLIC_SITE.patreonUrl ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(PUBLIC_SITE.patreonUrl!)} style={styles.supportButton}><Text style={styles.supportButtonTitle}>Patreon</Text><Text style={styles.supportButtonMeta}>Monthly support</Text></Pressable> : null}
        </View>
        {!PUBLIC_SITE.buyMeACoffeeUrl && !PUBLIC_SITE.patreonUrl ? <Text style={styles.small}>Support links are being configured. No payment is collected here until the owner adds verified public profile URLs.</Text> : null}
      </View>
      <Text style={styles.footer}>A return from Checkout is not a receipt. Pro unlocks only after the payment provider is verified. App Store purchases use Apple’s native purchase flow, not an Apple Pay button inside the app.</Text>
      <PolicyLinks />
    </ScrollView>
  </ScreenContainer>;
}
const styles = StyleSheet.create({
  shell: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 22, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 19, paddingBottom: 32 },
  brand: { fontSize: 23, letterSpacing: -0.9, color: palette.text, fontWeight: '700' },
  mode: { color: palette.muted, fontSize: 8, letterSpacing: 0.7 },
  eyebrow: { color: palette.lime, fontSize: 9, letterSpacing: 1.7, marginBottom: 10 },
  title: { color: palette.text, fontSize: 31, fontWeight: '600', letterSpacing: -1 },
  subtitle: { color: palette.muted, fontSize: 12, lineHeight: 19, marginTop: 9, marginBottom: 21 },
  notice: { marginBottom: 16 }, testNote: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginBottom: 18 },
  testText: { color: palette.muted, flex: 1, fontSize: 11, lineHeight: 17 },
  offer: { backgroundColor: palette.panel, borderWidth: 1, borderColor: '#52623B', borderRadius: 16, padding: 22 },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  offerName: { color: palette.text, fontSize: 20, fontWeight: '600' },
  lifetime: { color: palette.lime, borderWidth: 1, borderColor: '#52623B', borderRadius: 4, padding: 6, fontSize: 8, letterSpacing: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 23 },
  price: { color: palette.text, fontSize: 43, letterSpacing: -2, fontWeight: '600' },
  priceLabel: { color: palette.text, fontSize: 12 }, priceDetail: { color: palette.muted, fontSize: 9, marginTop: 5 },
  rule: { height: 1, backgroundColor: palette.line, marginVertical: 22 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }, benefitText: { color: '#C4CDBF', fontSize: 12, flex: 1 },
  limitNote: { color: palette.muted, fontSize: 10, lineHeight: 17, marginTop: 8 }, wallets: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 12, textAlign: 'center' },
  free: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: palette.line },
  freeTitle: { color: palette.text, fontSize: 15, fontWeight: '500' }, freeText: { color: palette.muted, fontSize: 11, lineHeight: 18, marginTop: 7 },
  freeCount: { color: '#46523C', fontFamily: mono, fontSize: 33 }, account: { paddingVertical: 24 },
  sectionTitle: { color: palette.muted, fontSize: 9, letterSpacing: 1.1, marginBottom: 13 }, accountName: { color: palette.text, fontSize: 15 },
  accountMeta: { color: palette.muted, fontSize: 10, marginTop: 5 }, accessState: { color: palette.lime, fontFamily: mono, fontSize: 10, marginTop: 13 },
  signOut: { minHeight: 36, alignItems: 'center', justifyContent: 'center' }, small: { color: palette.muted, fontSize: 10, lineHeight: 17, marginTop: 14 },
  catalog: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 22, marginTop: 24 }, catalogIntro: { color: palette.muted, fontSize: 11, lineHeight: 18, marginBottom: 12 }, catalogRow: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.line }, catalogName: { color: palette.text, fontSize: 12, fontWeight: '600' }, catalogDescription: { color: palette.muted, fontSize: 10, lineHeight: 15 }, catalogFeatures: { color: '#AEBBA3', fontSize: 9, lineHeight: 14 }, catalogPrice: { color: palette.text, fontFamily: mono, fontSize: 11, textAlign: 'right' }, catalogStatus: { color: palette.muted, fontSize: 8, letterSpacing: 0.7 },
  history: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 22 }, empty: { color: palette.muted, fontSize: 11, lineHeight: 18 },
  historyRow: { flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: palette.line }, historyTitle: { color: palette.text, fontSize: 12 },
  historyAmount: { color: palette.text, fontFamily: mono, fontSize: 12 }, historyStatus: { fontSize: 8, marginTop: 7, letterSpacing: 0.5 },
  support: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 22, marginTop: 24 }, supportText: { color: palette.muted, fontSize: 11, lineHeight: 18, marginBottom: 14 }, supportRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, supportButton: { borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 13, minWidth: 145, flexGrow: 1 }, supportButtonTitle: { color: palette.text, fontSize: 12, fontWeight: '600' }, supportButtonMeta: { color: palette.muted, fontSize: 9, marginTop: 5 },
  footer: { color: palette.muted, fontSize: 10, lineHeight: 17, marginTop: 22 },
});
