import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { Purchase } from 'expo-iap';
import { PRO_OFFER } from '@/shared/billing';
import { billingCall } from './api';
import type { NativeBridgeProps, NativePurchaseActions } from './native.types';

export function NativePurchaseBridge({ status, register, refresh, message, setBusy }: NativeBridgeProps) {
  const userId = status?.user?.id;
  const accountToken = status?.appAccountToken;
  const backendReady = status?.appleReady === true;
  useEffect(() => {
    let cancelled = false;
    let iap: typeof import('expo-iap') | null = null;
    let updated: { remove: () => void } | undefined;
    let failed: { remove: () => void } | undefined;
    const inFlight = new Set<string>();
    const unavailable = (reason: string) => {
      const reject = async () => { throw new Error(reason); };
      register({ ready: false, reason, buy: reject, restore: reject });
    };
    if (Platform.OS !== 'ios') { unavailable('In-app purchasing is not configured for Android. Sign in to restore existing account access.'); return; }
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) { unavailable('App Store buying requires a signed native build, not Expo Go. Free 3-image batches still work.'); return; }
    if (!backendReady) { unavailable('App Store payments are awaiting owner setup. Free 3-image batches still work.'); return; }
    if (!userId || !accountToken) { unavailable('Sign in to connect App Store purchases to your account.'); return; }

    async function fulfill(purchase: Purchase) {
      if (!iap || purchase.productId !== PRO_OFFER.appleProductId || inFlight.has(purchase.id)) return;
      if (purchase.purchaseState === 'pending') { setBusy(false); message('App Store purchase is pending approval. Pro has not been unlocked.'); return; }
      inFlight.add(purchase.id);
      setBusy(true);
      try {
        if (!purchase.purchaseToken) throw new Error('App Store did not return a signed purchase token.');
        const result = await billingCall<{ fulfilled: boolean }>('/api/billing/apple/verify', { jws: purchase.purchaseToken });
        if (!result.fulfilled) throw new Error('App Store purchase is not fulfilled.');
        await iap.finishTransaction({ purchase, isConsumable: false });
        await refresh();
        message('App Store purchase verified. Pro is active on this account.');
      } catch (error) { message(error instanceof Error ? error.message : 'Purchase verification failed. Retry Restore after checking your account.', true); throw error; }
      finally { inFlight.delete(purchase.id); setBusy(false); }
    }
    async function connect() {
      try {
        // This require is never evaluated in Expo Go; the browser uses native.web.tsx.
        iap = require('expo-iap') as typeof import('expo-iap');
        updated = iap.purchaseUpdatedListener((purchase) => { void fulfill(purchase).catch(() => {}); });
        failed = iap.purchaseErrorListener((error) => {
          setBusy(false);
          message(iap?.isUserCancelledError(error) ? 'Purchase cancelled. Your free access is unchanged.' : 'App Store purchase did not complete. No new access has been granted.', !iap?.isUserCancelledError(error));
        });
        if (!(await iap.initConnection())) throw new Error('Could not connect to the App Store.');
        const products = await iap.fetchProducts({ skus: [PRO_OFFER.appleProductId], type: 'in-app' });
        if (cancelled) return;
        const product = Array.isArray(products) ? products.find((p) => p.id === PRO_OFFER.appleProductId) : undefined;
        if (!product) throw new Error('Pro product was not found. Owner must finish App Store Connect product setup.');
        const actions: NativePurchaseActions = {
          ready: true, reason: null, displayPrice: product.displayPrice,
          buy: async () => {
            if (!iap || cancelled) throw new Error('App Store disconnected.');
            setBusy(true);
            try { await iap.requestPurchase({ type: 'in-app', request: { apple: { sku: PRO_OFFER.appleProductId, appAccountToken: accountToken } } }); }
            catch (error) { setBusy(false); throw error; }
          },
          restore: async () => {
            if (!iap || cancelled) throw new Error('App Store disconnected.');
            setBusy(true);
            try {
              await iap.restorePurchases();
              const purchases = await iap.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true, alsoPublishToEventListenerIOS: false });
              const owned = purchases.filter((p) => p.productId === PRO_OFFER.appleProductId);
              for (const purchase of owned) await fulfill(purchase);
              await refresh();
              if (!owned.length) message('No active GameShot Pro purchase was found in this App Store account.');
            } finally { setBusy(false); }
          },
        };
        register(actions);
      } catch (error) { if (!cancelled) unavailable(error instanceof Error ? error.message : 'App Store connection is unavailable.'); }
    }
    void connect();
    return () => { cancelled = true; updated?.remove(); failed?.remove(); register(null); setBusy(false); if (iap) void iap.endConnection().catch(() => {}); };
  }, [userId, accountToken, backendReady, register, refresh, message, setBusy]);
  return null;
}
