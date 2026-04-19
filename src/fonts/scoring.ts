import type { FontDescriptor } from '@/shared/types';

const W = { cls: 1.0, weight: 0.0008, italic: 0.4, capH: 0.002, xH: 0.002, avg: 0.002 };

export function scoreMatch(a: FontDescriptor, b: FontDescriptor): number {
  let s = 0;
  if (a.class !== b.class && a.class !== 'unknown' && b.class !== 'unknown') s += W.cls;
  s += W.weight * Math.abs(a.weight - b.weight);
  if (a.italic !== b.italic) s += W.italic;
  s += W.capH * Math.abs(a.metrics.capHeight - b.metrics.capHeight);
  s += W.xH * Math.abs(a.metrics.xHeight - b.metrics.xHeight);
  s += W.avg * Math.abs(a.metrics.avgAdvance - b.metrics.avgAdvance);
  return s;
}

export const GOOD_MATCH_THRESHOLD = 0.15;
