import { Platform } from 'react-native';
import { apiCall } from '@/lib/_core/api';

export async function billingCall<T>(path: string, body?: unknown): Promise<T> {
  const options: RequestInit = body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) };
  if (Platform.OS !== 'web') return apiCall<T>(path, options);
  // Metro's fixed API proxy keeps nonce/session cookies on the visible browser origin.
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Payment request failed.');
  return data as T;
}
