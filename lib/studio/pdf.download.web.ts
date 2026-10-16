function safePdfName(name: string): string {
  const stem = (typeof name === 'string' ? name : 'GameShot-layout.pdf')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\.+$/, '').slice(0, 120) || 'GameShot-layout';
  return stem.toLowerCase().endsWith('.pdf') ? stem : `${stem}.pdf`;
}

/** Browser-only local download; bytes are never sent to a server. */
export async function downloadPdf(bytes: Uint8Array, name: string): Promise<void> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') throw new Error('PDF download is only available in a browser window.');
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = safePdfName(name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
