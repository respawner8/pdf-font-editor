import { describe, it, expect } from 'vitest';
import { scoreMatch } from '@/fonts/scoring';
import type { FontDescriptor } from '@/shared/types';

const helvetica: FontDescriptor = {
  postScriptName: 'Helvetica',
  class: 'sans', weight: 400, italic: false,
  metrics: { ascent: 718, descent: -207, capHeight: 718, xHeight: 523, avgAdvance: 478, em: 1000 }
};

const liberationSans: FontDescriptor = {
  postScriptName: 'LiberationSans',
  class: 'sans', weight: 400, italic: false,
  metrics: { ascent: 720, descent: -210, capHeight: 720, xHeight: 525, avgAdvance: 480, em: 1000 }
};

const times: FontDescriptor = {
  postScriptName: 'Times-Roman',
  class: 'serif', weight: 400, italic: false,
  metrics: { ascent: 683, descent: -217, capHeight: 662, xHeight: 450, avgAdvance: 445, em: 1000 }
};

describe('scoreMatch', () => {
  it('scores near-identical sans at ~0', () => {
    expect(scoreMatch(helvetica, liberationSans)).toBeLessThan(0.02);
  });
  it('penalises class mismatch heavily', () => {
    expect(scoreMatch(helvetica, times)).toBeGreaterThan(1.0);
  });
  it('penalises weight mismatch', () => {
    const heavy = { ...liberationSans, weight: 900 };
    expect(scoreMatch(helvetica, heavy)).toBeGreaterThan(0.3);
  });
  it('penalises italic mismatch', () => {
    const italic = { ...liberationSans, italic: true };
    expect(scoreMatch(helvetica, italic)).toBeGreaterThan(0.3);
  });
});
