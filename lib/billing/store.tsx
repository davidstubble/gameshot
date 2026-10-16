import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { getRedirectUri } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import { PRO_OFFER, requiresPro, type BillingStatus } from '@/shared/billing';
import { billingCall } from './api';
import { NativePurchaseBridge } from './native';
import type { NativePurchaseActions } from './native.types';

export const LOGIN_VERIFIER_KEY = 'gameshot_login_verifier';
type BillingStore = {
  status: BillingStatus | null; isPro: boolean; loading: boolean; busy: boolean;
  notice: string | null; failed: boolean; native: NativePurchaseActions | null;
  refresh: () => Promise<boolean>; login: () => Promise<void>; logout: () => Promise<void>;
  buy: () => Promise<void>; restore: () => Promise<void>; clearNotice: () => void;
  confirmCheckout: (sessionId: string) => Promise<void>;
  authorizeBatch: (imageCount: number) => Promise<boolean>;
};
const Context = createContext<BillingStore | null>(null);
export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nativeBusy, setNativeBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [native, setNative] = useState<NativePurchaseActions | null>(null);
  const requestSequence = useRef(0);
  const message = useCallback((text: string, error = false) => { setNotice(text); setFailed(error); }, []);
  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const next = await billingCall<BillingStatus>('/api/billing/status');
      if (sequence !== requestSequence.current) return false;
      setStatus(next); return true;
    } catch {
      if (sequence === requestSequence.current) { setStatus(null); message('Could not refresh paid access. Free batches up to 3 images still work.', true); }
      return false;
    } finally { if (sequence === requestSequence.current) setLoading(false); }
  }, [message]);
  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    const focus = () => { void refresh(); };
    if (Platform.OS === 'web') window.addEventListener('focus', focus);
    return () => { subscription.remove(); if (Platform.OS === 'web') window.removeEventListener('focus', focus); };
  }, [refresh]);
  const register = useCallback((actions: NativePurchaseActions | null) => setNative(() => actions), []);

  async function login() {
    try {
      if (Platform.OS === 'web') {
        const origin = window.location.origin;
        const popup = window.open(`/api/billing/login?origin=${encodeURIComponent(origin)}`, '_blank');
        if (!popup) throw new Error('Allow pop-ups or open GameShot in a separate browser tab to sign in.');
        popup.opener = null;
        message('Sign-in opened in a new tab. Return here and refresh access when finished.');
      } else {
        const verifier = Array.from(await Crypto.getRandomBytesAsync(32), (b) => b.toString(16).padStart(2, '0')).join('');
        const verifierHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier);
        const { url } = await billingCall<{ url: string }>('/api/billing/login/start', { verifierHash, redirectUri: getRedirectUri() });
        await SecureStore.setItemAsync(LOGIN_VERIFIER_KEY, verifier);
        await Linking.openURL(url);
      }
    } catch (error) { message(error instanceof Error ? error.message : 'Could not start sign-in.', true); }
  }
  async function logout() {
    requestSequence.current++;
    setStatus(null);
    try { await billingCall('/api/auth/logout', {}); }
    finally { await Auth.removeSessionToken(); await Auth.clearUserInfo(); setStatus(null); await refresh(); }
  }
  async function buy() {
    if (!status?.user) { await login(); return; }
    if (status.isPro) { message('This account already owns Pro.'); return; }
    if (Platform.OS !== 'web') {
      if (!native?.ready) { message(native?.reason || 'App Store purchases are not available in this build.', true); return; }
      try { await native.buy(); } catch (error) { message(error instanceof Error ? error.message : 'App Store purchase failed.', true); }
      return;
    }
    if (!status.webReady) { message('Pro purchasing is temporarily unavailable while live payment setup is completed. Free batches up to 3 images still work.', true); return; }
    const popup = window.open('about:blank', '_blank');
    if (!popup) { message('Allow pop-ups to open secure Checkout, or use a separate browser tab.', true); return; }
    popup.opener = null;
    setBusy(true);
    try {
      const checkout = await billingCall<{ url: string; environment: 'test' | 'live' }>('/api/billing/checkout', { origin: window.location.origin });
      const url = new URL(checkout.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Unexpected Checkout destination.');
      popup.location.href = checkout.url;
      message(checkout.environment === 'test' ? 'Test Checkout opened in a new tab. Test payments do not move real money.' : 'Secure Checkout opened in a new tab.');
    } catch (error) { popup.close(); message(error instanceof Error ? error.message : 'Could not open Checkout.', true); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!status?.user) { await login(); return; }
    if (Platform.OS === 'ios' && native?.ready) {
      try { await native.restore(); } catch (error) { message(error instanceof Error ? error.message : 'Could not restore App Store access.', true); }
    } else {
      if (await refresh()) message('Verified account purchase records refreshed. If you bought with another account, sign in with that account.');
    }
  }
  const confirmCheckout = useCallback(async (sessionId: string) => {
    try {
      const result = await billingCall<{ status: string; isPro: boolean }>('/api/billing/checkout/status', { sessionId });
      await refresh();
      message(result.isPro ? 'Payment verified. Pro is active on this account.' : result.status === 'expired' ? 'This Checkout expired. Your free access is unchanged.' : result.status === 'failed' ? 'Payment did not complete. Pro has not been unlocked.' : 'Payment is still processing. Refresh access shortly; Pro unlocks only after verification.');
    } catch { message('Could not verify this Checkout for the signed-in account. Sign in and refresh your purchase records.', true); }
  }, [refresh, message]);
  async function authorizeBatch(imageCount: number) {
    if (!requiresPro(imageCount)) return true;
    const result = await billingCall<{ authorized: boolean }>('/api/billing/authorize', { imageCount });
    return result.authorized === true;
  }
  const value: BillingStore = { status, isPro: status?.isPro === true, loading, busy: busy || nativeBusy,
    notice, failed, native, refresh, login, logout, buy, restore, clearNotice: () => setNotice(null), confirmCheckout, authorizeBatch };
  const bridge = useMemo(() => ({ status, register, refresh, message, setBusy: setNativeBusy }), [status, register, refresh, message]);
  return <Context.Provider value={value}><NativePurchaseBridge {...bridge} />{children}</Context.Provider>;
}
export function useBilling() {
  const value = useContext(Context);
  if (!value) throw new Error('BillingProvider is missing.');
  return value;
}
export { PRO_OFFER };
