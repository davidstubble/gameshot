import { describe, expect, it } from 'vitest';
import { createSerialQueue } from '../lib/crop/serial-queue';

describe('saved library operation ordering', () => {
  it('reopens only after consecutive reorder writes complete', async () => {
    const enqueue = createSerialQueue();
    let order = 'original';
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const first = enqueue(async () => { await gate; order = 'first-edit'; });
    const second = enqueue(async () => { order = 'final-edit'; });
    const reopened = enqueue(async () => order);
    expect(order).toBe('original');
    release();
    await Promise.all([first, second]);
    expect(await reopened).toBe('final-edit');
  });
  it('rejects a failed write to its caller but allows the next retry', async () => {
    const enqueue = createSerialQueue();
    const failed = enqueue(async () => { throw new Error('storage full'); });
    const retry = enqueue(async () => 'saved');
    await expect(failed).rejects.toThrow('storage full');
    await expect(retry).resolves.toBe('saved');
  });
});
