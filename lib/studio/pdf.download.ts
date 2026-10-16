// Metro selects pdf.download.web.ts or pdf.download.native.ts at runtime.
// This fallback avoids eagerly loading a native module in Node unit tests.
export async function downloadPdf(bytes: Uint8Array, name: string): Promise<void> {
  const native = await import('./pdf.download.native');
  await native.downloadPdf(bytes, name);
}
