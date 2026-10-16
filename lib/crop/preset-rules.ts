import { validateSettings } from './geometry';
import type { CropSettings } from './types';

export const PRESET_LIMIT = 30;
export const PRESET_NAME_MAX = 40;
export type PresetSettings = Omit<CropSettings, 'mode'> & { mode: 'pixels' | 'ratio' };
export type SavedPreset = { id: string; name: string; createdAt: number; settings: PresetSettings };

const KEYS = ['width', 'height', 'x', 'y', 'ratioWidth', 'ratioHeight'] as const;

export function cleanPresetName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, PRESET_NAME_MAX);
}

function pickSettings(settings: CropSettings): PresetSettings {
  if (settings.mode === 'preset') throw new Error('Switch to Pixels or Aspect ratio to save a custom crop.');
  const finite = (n: number, fallback: number) => (Number.isFinite(n) ? n : fallback);
  return {
    mode: settings.mode, width: settings.width.trim(), height: settings.height.trim(), x: settings.x.trim(), y: settings.y.trim(),
    centered: settings.centered === true, ratioWidth: settings.ratioWidth.trim(), ratioHeight: settings.ratioHeight.trim(),
    scale: Math.min(1, Math.max(0.1, finite(settings.scale, 1))),
    anchorX: Math.min(1, Math.max(0, finite(settings.anchorX, 0.5))), anchorY: Math.min(1, Math.max(0, finite(settings.anchorY, 0.5))),
    format: settings.format === 'jpeg' ? 'jpeg' : 'png',
  };
}

/** Builds a new preset or explains why it cannot be saved. Same-name presets are replaced in place. */
export function createPreset(name: string, settings: CropSettings, existing: readonly SavedPreset[], now = Date.now()): SavedPreset {
  const clean = cleanPresetName(name);
  if (!clean) throw new Error('Give this crop a name, such as “Valorant scoreboard”.');
  const picked = pickSettings(settings);
  const invalid = validateSettings(picked);
  if (invalid) throw new Error(invalid);
  const replacing = existing.find((preset) => preset.name.toLowerCase() === clean.toLowerCase());
  if (!replacing && existing.length >= PRESET_LIMIT) throw new Error(`You can keep ${PRESET_LIMIT} saved crops. Delete one first.`);
  return { id: replacing?.id ?? `${now}-${Math.random().toString(36).slice(2, 8)}`, name: clean, createdAt: replacing?.createdAt ?? now, settings: picked };
}

export function upsertPreset(existing: readonly SavedPreset[], preset: SavedPreset): SavedPreset[] {
  const others = existing.filter((item) => item.id !== preset.id);
  return [preset, ...others].slice(0, PRESET_LIMIT);
}

/** Ignores corrupted, foreign or no-longer-valid stored presets instead of loading unsafe values. */
export function readPresets(raw: unknown): SavedPreset[] {
  if (!Array.isArray(raw)) return [];
  const result: SavedPreset[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    const s = p.settings as Record<string, unknown> | undefined;
    if (typeof p.id !== 'string' || typeof p.name !== 'string' || typeof p.createdAt !== 'number' || !s) continue;
    if ((s.mode !== 'pixels' && s.mode !== 'ratio') || !KEYS.every((key) => typeof s[key] === 'string')) continue;
    if (![s.scale, s.anchorX, s.anchorY].every((n) => typeof n === 'number' && Number.isFinite(n))) continue;
    try {
      const name = cleanPresetName(p.name);
      if (!name) continue;
      const settings = pickSettings({ ...(s as unknown as CropSettings) });
      if (validateSettings(settings)) continue;
      result.push({ id: p.id, name, createdAt: p.createdAt, settings });
    } catch { /* skip invalid entry */ }
    if (result.length >= PRESET_LIMIT) break;
  }
  return result;
}

export function describePreset(preset: SavedPreset): string {
  const s = preset.settings, format = s.format === 'jpeg' ? 'JPG' : 'PNG';
  if (s.mode === 'pixels') return `${s.width} × ${s.height} px · ${s.centered ? 'centered' : `X ${s.x} Y ${s.y}`} · ${format}`;
  return `${s.ratioWidth}:${s.ratioHeight} · ${Math.round(s.scale * 100)}% · ${format}`;
}
