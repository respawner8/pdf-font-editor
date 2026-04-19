import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { writePdf } from '@/editor/writer';
import { PDFDocument } from 'pdf-lib';
import type { EditOp, SubstituteFont, TextItem } from '@/shared/types';

function loadFixture(): ArrayBuffer {
  const bytes = fs.readFileSync(path.resolve('test/fixtures/hello.pdf'));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('writePdf', () => {
  it('saves an unchanged PDF when no ops apply', async () => {
    const out = await writePdf(loadFixture(), [] as EditOp[], new Map());
    expect(out.byteLength).toBeGreaterThan(100);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('applies an insert op', async () => {
    const ops: EditOp[] = [{
      op: 'insert', pageIdx: 0, x: 50, y: 50,
      text: 'Inserted line', fontFamily: 'Helvetica', fontSize: 14, color: '#000000'
    }];
    const out = await writePdf(loadFixture(), ops, new Map());
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('applies a replace op via mask + redraw', async () => {
    const items = new Map<string, TextItem>([
      ['p0-t0', { id: 'p0-t0', pageIdx: 0, text: 'Hello World',
                  x: 50, y: 150, width: 120, height: 24,
                  fontRef: 'F1', fontSize: 24, color: '#000' }]
    ]);
    const subs: Map<string, SubstituteFont> = new Map([
      ['F1', { family: 'Helvetica', source: 'registry', score: 0 }]
    ]);
    const out = await writePdf(loadFixture(), [
      { op: 'replace', pageIdx: 0, textItemId: 'p0-t0', newText: 'Edited' }
    ], subs, items);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
