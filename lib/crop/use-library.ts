import { useCallback, useEffect, useMemo, useState } from 'react';
import { keepBatch, libraryAvailable, libraryLocation, listSaved, openSaved, removeSaved, updateSavedOrder } from './local-library';
import { sortSummaries, type SavedBatchSummary } from './library-rules';
import type { BatchResult } from './types';
import { createSerialQueue } from './serial-queue';

/** Loads the opt-in device library only for accounts allowed to use it. */
export function useDeviceLibrary(enabled: boolean) {
  const available = libraryAvailable();
  const [enqueue] = useState(() => createSerialQueue());
  const [summaries, setSummaries] = useState<SavedBatchSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (isLive: () => boolean = () => true) => {
    if (!enabled || !available) return;
    try { const list = await enqueue(listSaved); if (isLive()) { setSummaries(list); setError(null); } }
    catch (cause) { if (isLive()) setError(cause instanceof Error ? cause.message : 'Could not read saved batches.'); }
    finally { if (isLive()) setLoaded(true); }
  }, [enabled, available, enqueue]);
  useEffect(() => {
    let live = true;
    void refresh(() => live);
    return () => { live = false; };
  }, [refresh]);

  const keep = useCallback(async (batch: BatchResult) => {
    const summary = await enqueue(() => keepBatch(batch));
    setSummaries((old) => sortSummaries([summary, ...old.filter((item) => item.id !== summary.id)]));
    return summary;
  }, [enqueue]);
  const remove = useCallback(async (id: string) => {
    const result = await enqueue(() => removeSaved(id));
    setSummaries((old) => old.filter((item) => item.id !== id));
    return result;
  }, [enqueue]);
  const open = useCallback((id: string) => enqueue(() => openSaved(id)), [enqueue]);
  const updateOrder = useCallback((id: string, order: string[] | undefined) => enqueue(() => updateSavedOrder(id, order)), [enqueue]);
  const savedIds = useMemo(() => new Set(summaries.map((item) => item.id)), [summaries]);
  return { available, enabled, loaded, error, summaries, savedIds, location: libraryLocation, refresh, keep, remove, open, updateOrder };
}
