import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Auth from '@/lib/_core/auth';
import { billingCall } from '@/lib/billing/api';
import { LOGIN_VERIFIER_KEY } from '@/lib/billing/store';
import { ScreenContainer } from '@/components/screen-container';
import { ActionButton, CropMark, palette } from '@/components/crop/ui';

export default function OAuthCallback() {
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        if (params.error || typeof params.code !== 'string' || typeof params.state !== 'string') throw new Error('Missing or rejected login callback. Start sign-in again.');
        const nativeVerifier = Platform.OS === 'web' ? undefined : await SecureStore.getItemAsync(LOGIN_VERIFIER_KEY);
        if (Platform.OS !== 'web' && !nativeVerifier) throw new Error('No matching sign-in request is stored on this device.');
        const result = await billingCall<{ sessionToken?: string; user: Auth.User }>('/api/billing/login/complete', {
          code: params.code, state: params.state, ...(nativeVerifier ? { nativeVerifier } : {}),
        });
        if (Platform.OS !== 'web') {
          if (!result.sessionToken) throw new Error('No verified session was returned.');
          await Auth.setSessionToken(result.sessionToken);
          await SecureStore.deleteItemAsync(LOGIN_VERIFIER_KEY);
        }
        await Auth.setUserInfo({ ...result.user, lastSignedIn: new Date(result.user.lastSignedIn) });
        router.replace('/(tabs)/pro');
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Sign-in could not be verified.'); }
    })();
  }, [params.code, params.state, params.error, router]);
  return <ScreenContainer style={{ backgroundColor: palette.bg }}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20 }}>
    <CropMark size={42} />
    {error ? <><Text style={{ color: palette.text, fontSize: 21, fontWeight: '600' }}>Sign-in needs another try</Text><Text style={{ color: palette.muted, textAlign: 'center', lineHeight: 21 }}>{error}</Text><ActionButton title="Return to Pro" onPress={() => router.replace('/(tabs)/pro')} secondary /></> : <><ActivityIndicator color={palette.lime} /><Text style={{ color: palette.text }}>Verifying your sign-in…</Text></>}
  </View></ScreenContainer>;
}
