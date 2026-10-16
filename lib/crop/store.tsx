import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { runBatch } from './batch';
import { normalizeOrder } from './export-tools';
import { clearSessionFiles, cropImage, pickImages, releaseSource } from './platform';
import { DEFAULT_SETTINGS, type BatchResult, type CropSettings, type SourceImage } from './types';
import { useBilling } from '@/lib/billing/store';

type CropStore = {
  images: SourceImage[]; activeId: string | null; settings: CropSettings;
  picking: boolean; processing: boolean; progress: number; currentName: string;
  batches: BatchResult[]; notice: string | null;
  setNotice: (message: string | null) => void;
  patchSettings: (patch: Partial<CropSettings>) => void;
  setActiveId: (id: string) => void;
  addImages: (fromFiles?: boolean) => Promise<void>;
  removeImage: (id: string) => void;
  process: () => Promise<BatchResult | null>;
  cancel: () => void;
  /** Shows a reopened saved batch first, replacing any session copy with the same id. */
  openBatch: (batch: BatchResult) => void;
  removeBatch: (id: string) => void;
  /** Stores a chosen posting order; undefined or import order returns to the original order. */
  setBatchOrder: (id: string, order: string[] | undefined) => void;
};
const Context = createContext<CropStore | null>(null);

export function CropProvider({ children }: { children: React.ReactNode }) {
  const billing = useBilling();
  const [images, setImages] = useState<SourceImage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<CropSettings>({ ...DEFAULT_SETTINGS });
  const [picking, setPicking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentName, setCurrentName] = useState('');
  const [batches, setBatches] = useState<BatchResult[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const cancellation = useRef(false);
  const busy = useRef(false);
  // Unkept crops are session-only: remove the previous launch's temporary copies once per launch.
  useEffect(() => { clearSessionFiles(); }, []);

  async function addImages(fromFiles = false) {
    if (busy.current) return;
    busy.current = true; setPicking(true); setNotice(null);
    try {
      const picked = await pickImages(fromFiles);
      if (picked.images.length) {
        setImages((old) => [...old, ...picked.images]);
        setActiveId((id) => id ?? picked.images[0].id);
      }
      if (picked.errors.length) setNotice(picked.errors.map((e) => `${e.name}: ${e.message}`).join('\n'));
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not select images.'); }
    finally { busy.current = false; setPicking(false); }
  }

  function removeImage(id: string) {
    if (busy.current) return;
    const source = images.find((image) => image.id === id);
    if (source) releaseSource(source);
    const remaining = images.filter((image) => image.id !== id);
    setImages(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id ?? null);
  }

  async function process(): Promise<BatchResult | null> {
    if (busy.current || !images.length) return null;
    busy.current = true; cancellation.current = false;
    setProcessing(true); setProgress(0); setNotice(null);
    try {
      if (!(await billing.authorizeBatch(images.length))) throw new Error('Pro access is required for this batch.');
      const result = await runBatch([...images], { ...settings }, cropImage, () => cancellation.current, (done, name) => {
        setProgress(done); setCurrentName(name);
      });
      setBatches((old) => [result, ...old]);
      return result;
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Batch processing failed.'); return null; }
    finally { setProcessing(false); busy.current = false; setCurrentName(''); }
  }

  const value: CropStore = {
    images, activeId, settings, picking, processing, progress, currentName, batches, notice,
    setNotice, setActiveId, addImages, removeImage, process,
    patchSettings: (patch) => { if (!busy.current) setSettings((old) => ({ ...old, ...patch })); },
    cancel: () => { cancellation.current = true; setNotice('Stopping after the current image. Completed crops will be kept.'); },
    openBatch: (batch) => setBatches((old) => [batch, ...old.filter((item) => item.id !== batch.id)]),
    removeBatch: (id) => setBatches((old) => old.filter((item) => item.id !== id)),
    setBatchOrder: (id, order) => setBatches((old) => old.map((batch) => {
      if (batch.id !== id) return batch;
      const { order: _previous, ...rest } = batch;
      const next = normalizeOrder(batch.outputs, order);
      return next ? { ...rest, order: next } : rest;
    })),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCrop() {
  const context = useContext(Context);
  if (!context) throw new Error('CropProvider is missing.');
  return context;
}
