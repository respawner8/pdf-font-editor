import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { RenderedPage, TextItem } from '@/shared/types';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface LoadedPdf {
  doc: PDFDocumentProxy;
  numPages: number;
  bytes: ArrayBuffer;
}

export async function loadPdf(bytes: ArrayBuffer, password?: string): Promise<LoadedPdf> {
  const doc = await pdfjsLib.getDocument({ data: bytes, password }).promise;
  return { doc, numPages: doc.numPages, bytes };
}

const RENDER_SCALE = 1.5;

export async function renderPage(loaded: LoadedPdf, pageIdx: number): Promise<RenderedPage> {
  const page = await loaded.doc.getPage(pageIdx + 1);
  const viewport = page.getViewport({ scale: RENDER_SCALE });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

  const textContent = await page.getTextContent();
  const textItems: TextItem[] = textContent.items
    .filter((it: any) => 'str' in it)
    .map((it: any, i: number): TextItem => {
      const [a, b, _c, _d, e, f] = it.transform as number[];
      const fontSize = Math.hypot(a, b);
      return {
        id: `p${pageIdx}-t${i}`,
        pageIdx,
        text: it.str,
        x: e,
        y: f,
        width: it.width,
        height: it.height,
        fontRef: it.fontName,
        fontSize,
        color: '#000000'
      };
    });

  return {
    pageIdx,
    canvas,
    viewport: { width: viewport.width, height: viewport.height, scale: RENDER_SCALE },
    textItems
  };
}
