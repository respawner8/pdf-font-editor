import type { SubstituteFont } from '@/shared/types';

export interface CacheKey { pdfHash: string; originalFontName: string; }
type CacheValue = SubstituteFont;

function kvKey(k: CacheKey): string { return `font:${k.pdfHash}:${k.originalFontName}`; }

export async function getCached(k: CacheKey): Promise<CacheValue | undefined> {
  const key = kvKey(k);
  const obj = await chrome.storage.local.get(key);
  return obj[key] as CacheValue | undefined;
}

export async function setCached(k: CacheKey, v: CacheValue): Promise<void> {
  await chrome.storage.local.set({ [kvKey(k)]: v });
}

export async function clearForPdf(pdfHash: string): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter(k => k.startsWith(`font:${pdfHash}:`));
  if (keys.length) await chrome.storage.local.remove(keys);
}
