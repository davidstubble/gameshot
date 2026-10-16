import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BatchResult } from '../lib/crop/types';

const fs = vi.hoisted(() => ({ files: new Set<string>(), deleted: [] as string[], store: new Map<string, string>(), failDelete: false, failCopy: false }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => fs.store.get(key) ?? null,
    setItem: async (key: string, value: string) => { fs.store.set(key, value); },
  },
}));
vi.mock('expo-file-system', () => {
  const join = (parts: unknown[]) => parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  return {
    Paths: { document: 'file:///docs', cache: 'file:///cache' },
    File: class {
      uri: string; constructor(...parts: unknown[]) { this.uri = join(parts); }
      get exists() { return fs.files.has(this.uri); }
      delete() { fs.files.delete(this.uri); }
      async copy(target: { uri: string }) { if (fs.failCopy) throw new Error('ENOSPC'); fs.files.add(target.uri); }
    },
    Directory: class {
      uri: string; constructor(...parts: unknown[]) { this.uri = join(parts); }
      get exists() { return [...fs.files].some((f) => f.startsWith(`${this.uri}/`)); }
      create() {}
      delete() {
        if (fs.failDelete) throw new Error('EBUSY');
        fs.deleted.push(this.uri);
        for (const f of [...fs.files]) if (f.startsWith(`${this.uri}/`)) fs.files.delete(f);
      }
    },
  };
});
import { keepBatch, listSaved, openSaved, removeSaved, updateSavedOrder } from '../lib/crop/local-library.native';

const session = (id: string) => `file:///cache/GameShot/session/${id}`;
const kept = (id: string) => `file:///docs/GameShot/kept/${id}`;
const batch = (id = 'b1'): BatchResult => ({
  id, createdAt: 1, total: 2, cancelled: false, errors: [],
  outputs: [1, 2].map((n) => ({ id: `${id}-${n}`, sequence: n, sourceName: `s${n}.png`, name: `000${n}_s${n}_cropped.png`, uri: `${session(id)}/000${n}_s${n}_cropped.png`, width: 10, height: 10, size: 5, format: 'png' as const, batchId: id })),
});
const addSession = (id: string) => batch(id).outputs.forEach((o) => fs.files.add(o.uri));
beforeEach(() => { fs.files.clear(); fs.deleted.length = 0; fs.store.clear(); fs.failDelete = false; fs.failCopy = false; });

describe('phone device library', () => {
  it('copies temporary session crops into durable kept storage and reopens from there', async () => {
    addSession('b1');
    await keepBatch(batch());
    expect([...fs.files].filter((f) => f.startsWith(kept('b1'))).sort()).toEqual([`${kept('b1')}/0001_s1_cropped.png`, `${kept('b1')}/0002_s2_cropped.png`]);
    expect(fs.store.get('gameshot.library.v1')).not.toContain('file:///');
    // Clearing temporary session storage (next launch) must not affect the kept copy.
    for (const f of [...fs.files]) if (f.startsWith(session('b1'))) fs.files.delete(f);
    await updateSavedOrder('b1', ['b1-2', 'b1-1']);
    const opened = await openSaved('b1');
    expect(opened.outputs.map((o) => o.uri)).toEqual([`${kept('b1')}/0001_s1_cropped.png`, `${kept('b1')}/0002_s2_cropped.png`]);
    expect(opened.order).toEqual(['b1-2', 'b1-1']);
    expect(opened.savedAt).toBeTypeOf('number');
  });
  it('does not persist anything unless the batch is kept', async () => {
    addSession('b1');
    expect([...fs.files].some((f) => f.startsWith('file:///docs'))).toBe(false);
    expect(await listSaved()).toEqual([]);
  });
  it('refuses to keep a batch whose temporary copy is gone, and cleans up a failed copy', async () => {
    fs.files.add(batch().outputs[0].uri);
    await expect(keepBatch(batch())).rejects.toThrow(/temporary storage/);
    addSession('b1'); fs.failCopy = true;
    await expect(keepBatch(batch())).rejects.toThrow(/space/);
    expect(await listSaved()).toEqual([]);
    expect([...fs.files].some((f) => f.startsWith(kept('b1')))).toBe(false);
  });
  it('lists kept copies deleted outside the app as issues instead of crashing', async () => {
    addSession('b1');
    await keepBatch(batch());
    fs.files.delete(`${kept('b1')}/0002_s2_cropped.png`);
    const opened = await openSaved('b1');
    expect(opened.outputs).toHaveLength(1);
    expect(opened.errors.map((e) => e.name)).toEqual(['0002_s2_cropped.png']);
  });
  it('removes only that batch’s kept folder, and keeps it listed when deletion fails', async () => {
    addSession('b1'); addSession('b2');
    await keepBatch(batch('b1')); await keepBatch(batch('b2'));
    fs.failDelete = true;
    await expect(removeSaved('b1')).rejects.toThrow(/still listed/);
    expect((await listSaved()).map((s) => s.id).sort()).toEqual(['b1', 'b2']);
    fs.failDelete = false;
    await expect(removeSaved('b1')).resolves.toEqual({ sessionCopyRemoved: true });
    expect(fs.deleted).toEqual([kept('b1')]);
    expect((await listSaved()).map((s) => s.id)).toEqual(['b2']);
    expect(batch('b1').outputs.every((o) => fs.files.has(o.uri))).toBe(true); // session copies untouched
    await expect(removeSaved('../b2')).rejects.toThrow();
  });
});
