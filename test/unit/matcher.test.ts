import { describe, it, expect, vi } from 'vitest';
import { resolveFont } from '@/fonts/matcher';
import type { FontDescriptor } from '@/shared/types';

const helvetica: FontDescriptor = {
  postScriptName: 'Helvetica',
  class: 'sans', weight: 400, italic: false,
  metrics: { ascent: 718, descent: -207, capHeight: 718, xHeight: 523, avgAdvance: 478, em: 1000 }
};

describe('resolveFont', () => {
  it('uses registry direct-hit when available', async () => {
    const sub = await resolveFont(helvetica, { loadGoogleFont: vi.fn(), searchGoogleFonts: vi.fn() });
    expect(sub.family).toBe('Arimo');
    expect(sub.source).toBe('registry');
  });

  it('falls back to bundled-core metric match when no registry hit', async () => {
    const weirdFont: FontDescriptor = { ...helvetica, postScriptName: 'AcmeGrotesk' };
    const sub = await resolveFont(weirdFont, { loadGoogleFont: vi.fn(), searchGoogleFonts: vi.fn().mockResolvedValue([]) });
    expect(['Arimo', 'Source Sans 3', 'Noto Sans', 'Carlito']).toContain(sub.family);
    expect(sub.source).toBe('core');
  });

  it('hits Google Fonts when core match is too far', async () => {
    const scriptFont: FontDescriptor = { ...helvetica, class: 'script', postScriptName: 'FancyScriptPro' };
    const searchGoogleFonts = vi.fn().mockResolvedValue([{ family: 'Pacifico', category: 'handwriting', variants: ['400'] }]);
    const loadGoogleFont = vi.fn().mockResolvedValue({} as FontFace);
    const sub = await resolveFont(scriptFont, { loadGoogleFont, searchGoogleFonts, forceGoogle: true });
    expect(sub.source).toBe('google-fonts');
    expect(sub.family).toBe('Pacifico');
  });
});
