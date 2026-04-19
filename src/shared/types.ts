export type FontClass = 'serif' | 'sans' | 'mono' | 'script' | 'unknown';

export interface FontMetrics {
  ascent: number;
  descent: number;
  capHeight: number;
  xHeight: number;
  avgAdvance: number;
  em: number;
}

export interface FontDescriptor {
  postScriptName: string;
  class: FontClass;
  weight: number;
  italic: boolean;
  metrics: FontMetrics;
}

export interface SubstituteFont {
  family: string;
  source: 'registry' | 'core' | 'google-fonts' | 'system';
  score: number;
  url?: string;
}

export type FontClassMatch = {
  original: FontDescriptor;
  substitute: SubstituteFont;
};

export type EditOp =
  | { op: 'replace'; pageIdx: number; textItemId: string; newText: string }
  | { op: 'insert';  pageIdx: number; x: number; y: number; text: string; fontFamily: string; fontSize: number; color: string }
  | { op: 'delete';  pageIdx: number; textItemId: string }
  | { op: 'move';    pageIdx: number; textItemId: string; dx: number; dy: number }
  | { op: 'resize';  pageIdx: number; textItemId: string; newFontSize: number };

export interface TextItem {
  id: string;
  pageIdx: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontRef: string;
  fontSize: number;
  color: string;
}

export interface RenderedPage {
  pageIdx: number;
  canvas: HTMLCanvasElement;
  viewport: { width: number; height: number; scale: number };
  textItems: TextItem[];
}
