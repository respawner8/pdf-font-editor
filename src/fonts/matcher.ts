import type { FontDescriptor, SubstituteFont } from '@/shared/types';
import { lookupRegistry } from './registry';
import { CORE_FONTS } from './core';
import { GOOD_MATCH_THRESHOLD, scoreMatch } from './scoring';
import * as gf from './google-fonts';

export interface MatcherDeps {
  searchGoogleFonts: typeof gf.searchGoogleFonts;
  loadGoogleFont: typeof gf.loadGoogleFont;
  forceGoogle?: boolean;
}

const DEFAULT_DEPS: MatcherDeps = {
  searchGoogleFonts: gf.searchGoogleFonts,
  loadGoogleFont: gf.loadGoogleFont
};

export async function resolveFont(
  target: FontDescriptor,
  deps: Partial<MatcherDeps> = {}
): Promise<SubstituteFont> {
  const d = { ...DEFAULT_DEPS, ...deps };

  if (!d.forceGoogle) {
    const hit = lookupRegistry(target.postScriptName);
    if (hit) {
      return { family: hit.family, source: 'registry', score: 0 };
    }
  }

  if (!d.forceGoogle) {
    let best = { family: '', score: Number.POSITIVE_INFINITY };
    for (const core of CORE_FONTS) {
      const s = scoreMatch(target, core.descriptor);
      if (s < best.score) best = { family: core.family, score: s };
    }
    if (best.score <= GOOD_MATCH_THRESHOLD) {
      return { family: best.family, source: 'core', score: best.score };
    }
  }

  try {
    const candidates = await d.searchGoogleFonts(target, 5);
    if (candidates.length > 0) {
      const first = candidates[0];
      await d.loadGoogleFont(first.family, target.weight, target.italic);
      return { family: first.family, source: 'google-fonts', score: 0.2 };
    }
  } catch (_err) {
    // offline / CDN failure — fall through
  }

  const systemFamily =
    target.class === 'serif' ? 'serif' :
    target.class === 'mono'  ? 'monospace' :
                               'sans-serif';
  return { family: systemFamily, source: 'system', score: 1.0 };
}
