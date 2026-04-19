export interface RegistryHit {
  family: string;
  weight: number;
  italic: boolean;
  source: 'google-fonts' | 'core';
}

interface Pattern {
  re: RegExp;
  base: { family: string; source: RegistryHit['source'] };
}

const PATTERNS: Pattern[] = [
  { re: /helvetica|arial/i,            base: { family: 'Arimo',          source: 'core' } },
  { re: /times(newroman)?/i,           base: { family: 'Tinos',          source: 'core' } },
  { re: /courier/i,                    base: { family: 'Cousine',        source: 'core' } },
  { re: /calibri/i,                    base: { family: 'Carlito',        source: 'core' } },
  { re: /cambria/i,                    base: { family: 'Caladea',        source: 'core' } },
  { re: /consolas/i,                   base: { family: 'Cousine',        source: 'core' } },
  { re: /georgia/i,                    base: { family: 'Source Serif 4', source: 'core' } },
  { re: /verdana|tahoma|segoe/i,       base: { family: 'Noto Sans',      source: 'core' } },
  { re: /palatino/i,                   base: { family: 'Source Serif 4', source: 'core' } },
  { re: /garamond/i,                   base: { family: 'EB Garamond',    source: 'google-fonts' } },
  { re: /bookman/i,                    base: { family: 'Bree Serif',     source: 'google-fonts' } }
];

const WEIGHT_RE = /thin|extralight|ultralight|light|regular|normal|book|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy/i;
const WEIGHT_MAP: Record<string, number> = {
  thin: 100, hairline: 100, extralight: 200, ultralight: 200, light: 300,
  regular: 400, normal: 400, book: 400, medium: 500,
  semibold: 600, demibold: 600, bold: 700, extrabold: 800, ultrabold: 800,
  black: 900, heavy: 900
};

function normalize(psName: string): string {
  return psName.replace(/^[A-Z]{6}\+/, '');
}

export function lookupRegistry(psName: string): RegistryHit | undefined {
  const name = normalize(psName);
  for (const { re, base } of PATTERNS) {
    if (re.test(name)) {
      const wm = name.match(WEIGHT_RE);
      const weight = wm ? WEIGHT_MAP[wm[0].toLowerCase()] ?? 400 : 400;
      const italic = /italic|oblique/i.test(name);
      return { family: base.family, weight, italic, source: base.source };
    }
  }
  return undefined;
}
