import type { FontDescriptor } from '@/shared/types';

export interface CoreFont {
  family: string;
  descriptor: FontDescriptor;
  fontsourcePkg: string;
}

export const CORE_FONTS: CoreFont[] = [
  {
    family: 'Arimo',
    fontsourcePkg: '@fontsource/arimo',
    descriptor: {
      postScriptName: 'Arimo',
      class: 'sans', weight: 400, italic: false,
      metrics: { ascent: 728, descent: -210, capHeight: 728, xHeight: 527, avgAdvance: 478, em: 1000 }
    }
  },
  {
    family: 'Tinos',
    fontsourcePkg: '@fontsource/tinos',
    descriptor: {
      postScriptName: 'Tinos',
      class: 'serif', weight: 400, italic: false,
      metrics: { ascent: 683, descent: -217, capHeight: 662, xHeight: 450, avgAdvance: 445, em: 1000 }
    }
  },
  {
    family: 'Cousine',
    fontsourcePkg: '@fontsource/cousine',
    descriptor: {
      postScriptName: 'Cousine',
      class: 'mono', weight: 400, italic: false,
      metrics: { ascent: 750, descent: -250, capHeight: 700, xHeight: 500, avgAdvance: 600, em: 1000 }
    }
  },
  {
    family: 'Carlito',
    fontsourcePkg: '@fontsource/carlito',
    descriptor: {
      postScriptName: 'Carlito',
      class: 'sans', weight: 400, italic: false,
      metrics: { ascent: 950, descent: -250, capHeight: 702, xHeight: 516, avgAdvance: 509, em: 2048 }
    }
  },
  {
    family: 'Caladea',
    fontsourcePkg: '@fontsource/caladea',
    descriptor: {
      postScriptName: 'Caladea',
      class: 'serif', weight: 400, italic: false,
      metrics: { ascent: 920, descent: -250, capHeight: 680, xHeight: 470, avgAdvance: 480, em: 2048 }
    }
  },
  {
    family: 'Source Sans 3',
    fontsourcePkg: '@fontsource/source-sans-3',
    descriptor: {
      postScriptName: 'SourceSans3',
      class: 'sans', weight: 400, italic: false,
      metrics: { ascent: 750, descent: -250, capHeight: 660, xHeight: 486, avgAdvance: 492, em: 1000 }
    }
  },
  {
    family: 'Source Serif 4',
    fontsourcePkg: '@fontsource/source-serif-4',
    descriptor: {
      postScriptName: 'SourceSerif4',
      class: 'serif', weight: 400, italic: false,
      metrics: { ascent: 750, descent: -250, capHeight: 660, xHeight: 475, avgAdvance: 490, em: 1000 }
    }
  },
  {
    family: 'Noto Sans',
    fontsourcePkg: '@fontsource/noto-sans',
    descriptor: {
      postScriptName: 'NotoSans',
      class: 'sans', weight: 400, italic: false,
      metrics: { ascent: 1069, descent: -293, capHeight: 714, xHeight: 536, avgAdvance: 565, em: 1000 }
    }
  }
];

const loaded = new Set<string>();

export async function ensureLoaded(family: string): Promise<void> {
  if (loaded.has(family)) return;
  const entry = CORE_FONTS.find(f => f.family === family);
  if (!entry) return;
  await import(/* @vite-ignore */ `${entry.fontsourcePkg}/400.css`);
  loaded.add(family);
}
