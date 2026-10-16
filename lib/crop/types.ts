export type CropMode = 'preset' | 'pixels' | 'ratio';
export type OutputFormat = 'png' | 'jpeg';
export type CropRect = { x: number; y: number; width: number; height: number };
export type Dimensions = { width: number; height: number };
export type CropSettings = {
  mode: CropMode;
  width: string;
  height: string;
  x: string;
  y: string;
  centered: boolean;
  ratioWidth: string;
  ratioHeight: string;
  scale: number;
  anchorX: number;
  anchorY: number;
  format: OutputFormat;
};
export type SourceImage = Dimensions & { id: string; uri: string; name: string; size?: number };
export type CropOutput = Dimensions & {
  id: string;
  sourceName: string;
  name: string;
  uri: string;
  size: number;
  format: OutputFormat;
  batchId: string;
  /** One-based position in the batch's import queue; absent on legacy session results. */
  sequence?: number;
};
export type BatchIssue = { name: string; message: string };
export type PickResult = { images: SourceImage[]; errors: BatchIssue[] };
export type BatchResult = {
  id: string;
  createdAt: number;
  outputs: CropOutput[];
  errors: BatchIssue[];
  cancelled: boolean;
  total: number;
  /** Output ids in a posting order the user chose; absent means import order. */
  order?: string[];
  /** Set when this batch was reopened from the on-device library. */
  savedAt?: number;
};
export const DEFAULT_SETTINGS: CropSettings = {
  mode: 'preset', width: '3350', height: '1700', x: '1488', y: '570',
  centered: false, ratioWidth: '16', ratioHeight: '9', scale: 1,
  anchorX: 0.5, anchorY: 0.5, format: 'png',
};
