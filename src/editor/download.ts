export async function downloadPdf(bytes: ArrayBuffer, suggestedName: string): Promise<void> {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (_err) {
    await new Promise<void>((resolve, reject) => {
      chrome.downloads.download({ url, filename: suggestedName, saveAs: true }, (id) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (id === undefined) reject(new Error('Download failed'));
        else resolve();
      });
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export function suggestedFilename(src: string): string {
  const base = src.split('/').pop() ?? 'document.pdf';
  try {
    const decoded = decodeURIComponent(base);
    return decoded.replace(/\.pdf$/i, '-edited.pdf');
  } catch {
    return base.replace(/\.pdf$/i, '-edited.pdf');
  }
}
