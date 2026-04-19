import type { FontClass, FontDescriptor, FontMetrics } from '@/shared/types';

interface GoogleFontEntry {
  family: string;
  category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
  variants: string[];
}

let metadataCache: GoogleFontEntry[] | null = null;

async function loadMetadata(): Promise<GoogleFontEntry[]> {
  if (metadataCache) return metadataCache;
  const res = await fetch('https://fonts.google.com/metadata/fonts');
  const text = await res.text();
  const json = JSON.parse(text.replace(/^\)\]\}'/, ''));
  metadataCache = (json.familyMetadataList ?? []).map((f: any) => ({
    family: f.family,
    category: f.category,
    variants: Object.keys(f.fonts ?? {})
  }));
  return metadataCache!;
}

function classMatches(cls: FontClass, cat: GoogleFontEntry['category']): boolean {
  if (cls === 'serif') return cat === 'serif';
  if (cls === 'sans')  return cat === 'sans-serif';
  if (cls === 'mono')  return cat === 'monospace';
  return true;
}

export async function searchGoogleFonts(target: FontDescriptor, topN = 5): Promise<GoogleFontEntry[]> {
  const meta = await loadMetadata();
  return meta.filter(e => classMatches(target.class, e.category)).slice(0, topN);
}

export async function loadGoogleFont(family: string, weight = 400, italic = false): Promise<FontFace> {
  const famParam = family.replace(/\s+/g, '+');
  const style = italic ? 'ital,wght@1,' + weight : 'wght@' + weight;
  const cssUrl = `https://fonts.googleapis.com/css2?family=${famParam}:${style}&display=swap`;
  const css = await (await fetch(cssUrl)).text();
  const urlMatch = css.match(/url\((https:[^)]+\.woff2)\)/);
  if (!urlMatch) throw new Error(`No woff2 URL in Google Fonts CSS for ${family}`);
  const fontFile = await (await fetch(urlMatch[1])).arrayBuffer();
  const face = new FontFace(family, fontFile, { weight: String(weight), style: italic ? 'italic' : 'normal' });
  await face.load();
  (document as any).fonts.add(face);
  return face;
}

export function measureMetrics(family: string, fontSize = 200): FontMetrics {
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${fontSize}px "${family}"`;
  const capM = ctx.measureText('H');
  const xM = ctx.measureText('x');
  const avgM = ctx.measureText('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
  return {
    ascent:     (capM.actualBoundingBoxAscent  ?? 0) / fontSize * 1000,
    descent:    -(capM.actualBoundingBoxDescent ?? 0) / fontSize * 1000,
    capHeight:  (capM.actualBoundingBoxAscent  ?? 0) / fontSize * 1000,
    xHeight:    (xM.actualBoundingBoxAscent    ?? 0) / fontSize * 1000,
    avgAdvance: (avgM.width / 62)               / fontSize * 1000,
    em: 1000
  };
}
