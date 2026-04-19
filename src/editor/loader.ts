export class FileUrlAccessDeniedError extends Error {
  constructor() {
    super('File URL access is denied. Enable "Allow access to file URLs" for this extension in chrome://extensions.');
    this.name = 'FileUrlAccessDeniedError';
  }
}

export async function loadPdfBytes(src: string): Promise<ArrayBuffer> {
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${src}`);
    return await res.arrayBuffer();
  } catch (err) {
    if (err instanceof TypeError && src.startsWith('file://')) {
      throw new FileUrlAccessDeniedError();
    }
    throw err;
  }
}
