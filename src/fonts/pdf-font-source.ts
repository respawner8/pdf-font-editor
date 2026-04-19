import type { PDFDocumentProxy } from 'pdfjs-dist';
import { analyze, type PdfFontSource } from '@/fonts/analyzer';
import type { FontDescriptor } from '@/shared/types';

export async function extractFontDescriptors(doc: PDFDocumentProxy): Promise<Map<string, FontDescriptor>> {
  const map = new Map<string, FontDescriptor>();
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    await page.getOperatorList();
    const commonObjs = (page as any).commonObjs;
    if (!commonObjs?._objs) continue;
    const fontRefs: string[] = Object.keys(commonObjs._objs)
      .filter(k => k.startsWith('g_d') || k.startsWith('f'));
    for (const ref of fontRefs) {
      if (map.has(ref)) continue;
      let obj: any;
      try { obj = commonObjs.get(ref); } catch { continue; }
      if (!obj || !obj.name) continue;
      const source: PdfFontSource = {
        psName: obj.name,
        flags: obj.descriptor?.flags ?? 0,
        ascent: obj.descriptor?.ascent,
        descent: obj.descriptor?.descent,
        capHeight: obj.descriptor?.capHeight,
        xHeight: obj.descriptor?.xHeight,
        avgWidth: obj.descriptor?.avgWidth,
        italicAngle: obj.descriptor?.italicAngle
      };
      map.set(ref, analyze(source));
    }
  }
  return map;
}
