import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { EditOp, SubstituteFont, TextItem } from '@/shared/types';

export interface WriteContext {
  loadFontBytes(family: string): Promise<ArrayBuffer>;
}

export async function writePdf(
  originalBytes: ArrayBuffer,
  ops: EditOp[],
  substitutes: Map<string, SubstituteFont>,
  textItemIndex: Map<string, TextItem> = new Map(),
  ctx?: Partial<WriteContext>
): Promise<ArrayBuffer> {
  const doc = await PDFDocument.load(originalBytes);
  doc.registerFontkit(fontkit);

  if (ops.length === 0) {
    return await doc.save();
  }

  const helv = await doc.embedFont(StandardFonts.Helvetica);

  const fontCache = new Map<string, any>();
  async function embedByFamily(family: string) {
    if (fontCache.has(family)) return fontCache.get(family);
    let font;
    if (ctx?.loadFontBytes) {
      try {
        const bytes = await ctx.loadFontBytes(family);
        font = await doc.embedFont(bytes, { subset: true });
      } catch {
        font = helv;
      }
    } else {
      font = helv;
    }
    fontCache.set(family, font);
    return font;
  }

  const mask = (page: any, item: TextItem) => {
    page.drawRectangle({
      x: item.x, y: item.y, width: item.width, height: item.height,
      color: rgb(1, 1, 1), borderWidth: 0
    });
  };

  for (const op of ops) {
    const page = doc.getPage(op.pageIdx);
    if (op.op === 'insert') {
      const font = await embedByFamily(op.fontFamily);
      page.drawText(op.text, { x: op.x, y: op.y, size: op.fontSize, font, color: rgb(0, 0, 0) });
    } else if (op.op === 'replace') {
      const item = textItemIndex.get(op.textItemId);
      if (!item) continue;
      mask(page, item);
      const sub = substitutes.get(item.fontRef);
      const font = await embedByFamily(sub?.family ?? 'Helvetica');
      page.drawText(op.newText, { x: item.x, y: item.y, size: item.fontSize, font, color: rgb(0, 0, 0) });
    } else if (op.op === 'delete') {
      const item = textItemIndex.get(op.textItemId);
      if (!item) continue;
      mask(page, item);
    } else if (op.op === 'move') {
      const item = textItemIndex.get(op.textItemId);
      if (!item) continue;
      mask(page, item);
      const sub = substitutes.get(item.fontRef);
      const font = await embedByFamily(sub?.family ?? 'Helvetica');
      page.drawText(item.text, { x: item.x + op.dx, y: item.y + op.dy, size: item.fontSize, font, color: rgb(0, 0, 0) });
    } else if (op.op === 'resize') {
      const item = textItemIndex.get(op.textItemId);
      if (!item) continue;
      mask(page, item);
      const sub = substitutes.get(item.fontRef);
      const font = await embedByFamily(sub?.family ?? 'Helvetica');
      page.drawText(item.text, { x: item.x, y: item.y, size: op.newFontSize, font, color: rgb(0, 0, 0) });
    }
  }

  return await doc.save();
}
