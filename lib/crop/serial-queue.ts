/** Keeps device-library read/write operations in the same order as user actions. */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation);
    // One failure must not block later retries; the original result still rejects to its caller.
    tail = result.catch(() => undefined);
    return result;
  };
}
