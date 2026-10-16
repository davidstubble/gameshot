import AsyncStorage from '@react-native-async-storage/async-storage';
import { readPresets, type SavedPreset } from './preset-rules';

const KEY = 'gameshot.presets.v1';

export async function loadPresets(): Promise<SavedPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? readPresets(JSON.parse(raw)) : [];
  } catch { return []; }
}

export async function storePresets(presets: readonly SavedPreset[]): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(presets)); }
  catch { throw new Error('This device would not save the crop. Free some storage or allow site data, then try again.'); }
}
