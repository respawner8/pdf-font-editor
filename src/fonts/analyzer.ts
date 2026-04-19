import type { FontClass, FontDescriptor, FontMetrics } from '@/shared/types';

const SERIF_NAMES = /Times|Georgia|Cambria|Garamond|Palatino|Bookman|Minion|Caslon|Baskerville/i;
const SANS_NAMES  = /Helvetica|Arial|Calibri|Verdana|Tahoma|Trebuchet|Segoe|Roboto|Open[ -]?Sans|Lato/i;
const MONO_NAMES  = /Courier|Consolas|Menlo|Monaco|Inconsolata|Mono/i;

const FLAG_FIXED_PITCH = 1 << 0;
const FLAG_SERIF       = 1 << 1;
const FLAG_ITALIC      = 1 << 6;

export function classifyFont(psName: string, flags: number): FontClass {
  if (flags & FLAG_FIXED_PITCH) return 'mono';
  if (flags & FLAG_SERIF) return 'serif';
  if (MONO_NAMES.test(psName)) return 'mono';
  if (SERIF_NAMES.test(psName)) return 'serif';
  if (SANS_NAMES.test(psName)) return 'sans';
  return 'unknown';
}

const WEIGHT_TOKENS: Record<string, number> = {
  thin: 100, hairline: 100,
  extralight: 200, ultralight: 200,
  light: 300,
  regular: 400, normal: 400, book: 400,
  medium: 500,
  semibold: 600, demibold: 600,
  bold: 700,
  extrabold: 800, ultrabold: 800,
  black: 900, heavy: 900
};

export function inferWeight(psName: string): number {
  const token = psName.toLowerCase().replace(/[^a-z]/g, '');
  for (const [key, w] of Object.entries(WEIGHT_TOKENS)) {
    if (token.includes(key)) return w;
  }
  return 400;
}

export function inferItalic(psName: string): boolean {
  return /italic|oblique/i.test(psName);
}

export function inferItalicFromFlags(flags: number): boolean {
  return Boolean(flags & FLAG_ITALIC);
}

export interface PdfFontSource {
  psName: string;
  flags: number;
  ascent?: number;
  descent?: number;
  capHeight?: number;
  xHeight?: number;
  avgWidth?: number;
  italicAngle?: number;
}

const DEFAULT_METRICS: FontMetrics = {
  ascent: 700, descent: -200, capHeight: 700, xHeight: 500, avgAdvance: 500, em: 1000
};

export function analyze(source: PdfFontSource): FontDescriptor {
  const italic = inferItalic(source.psName) || inferItalicFromFlags(source.flags) ||
                 (source.italicAngle !== undefined && source.italicAngle !== 0);
  return {
    postScriptName: source.psName,
    class: classifyFont(source.psName, source.flags),
    weight: inferWeight(source.psName),
    italic,
    metrics: {
      ascent:     source.ascent     ?? DEFAULT_METRICS.ascent,
      descent:    source.descent    ?? DEFAULT_METRICS.descent,
      capHeight:  source.capHeight  ?? DEFAULT_METRICS.capHeight,
      xHeight:    source.xHeight    ?? DEFAULT_METRICS.xHeight,
      avgAdvance: source.avgWidth   ?? DEFAULT_METRICS.avgAdvance,
      em:         DEFAULT_METRICS.em
    }
  };
}
