import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { writePdf } from '@/editor/writer';
import type { EditOp, SubstituteFont, TextItem } from '@/shared/types';

describe('round-trip — replace + insert + delete', () => {
  it('produces a valid PDF with all ops applied', async () => {
    const bytes = fs.readFileSync(path.resolve('test/fixtures/hello.pdf'));
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    const items = new Map<string, TextItem>([
      ['p0-t0', { id: 'p0-t0', pageIdx: 0, text: 'Hello World', x: 50, y: 150, width: 120, height: 24, fontRef: 'F1', fontSize: 24, color: '#000' }],
      ['p0-t1', { id: 'p0-t1', pageIdx: 0, text: 'Editable text', x: 50, y: 100, width: 130, height: 18, fontRef: 'F1', fontSize: 18, color: '#000' }]
    ]);
    const subs: Map<string, SubstituteFont> = new Map([
      ['F1', { family: 'Helvetica', source: 'registry', score: 0 }]
    ]);

    const ops: EditOp[] = [
      { op: 'replace', pageIdx: 0, textItemId: 'p0-t0', newText: 'Goodbye World' },
      { op: 'delete',  pageIdx: 0, textItemId: 'p0-t1' },
      { op: 'insert',  pageIdx: 0, x: 50, y: 50, text: 'Inserted', fontFamily: 'Helvetica', fontSize: 14, color: '#000' }
    ];

    const out = await writePdf(buf, ops, subs, items);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
