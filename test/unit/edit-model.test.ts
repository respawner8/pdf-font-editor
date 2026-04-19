import { describe, it, expect } from 'vitest';
import { EditModel } from '@/editor/edit-model';
import type { EditOp } from '@/shared/types';

const replace: EditOp = { op: 'replace', pageIdx: 0, textItemId: 'p0-t3', newText: 'Hello' };
const insert:  EditOp = { op: 'insert',  pageIdx: 1, x: 10, y: 20, text: 'Hi',
                          fontFamily: 'Arimo', fontSize: 12, color: '#000' };

describe('EditModel', () => {
  it('records ops in order', () => {
    const m = new EditModel();
    m.apply(replace);
    m.apply(insert);
    expect(m.ops()).toEqual([replace, insert]);
  });

  it('undoes the last op', () => {
    const m = new EditModel();
    m.apply(replace);
    m.apply(insert);
    m.undo();
    expect(m.ops()).toEqual([replace]);
  });

  it('redoes after undo', () => {
    const m = new EditModel();
    m.apply(replace);
    m.undo();
    m.redo();
    expect(m.ops()).toEqual([replace]);
  });

  it('redo stack clears on new apply', () => {
    const m = new EditModel();
    m.apply(replace);
    m.undo();
    m.apply(insert);
    m.redo();
    expect(m.ops()).toEqual([insert]);
  });

  it('collapses consecutive replaces on the same textItemId', () => {
    const m = new EditModel();
    m.apply({ op: 'replace', pageIdx: 0, textItemId: 'p0-t3', newText: 'H' });
    m.apply({ op: 'replace', pageIdx: 0, textItemId: 'p0-t3', newText: 'He' });
    m.apply({ op: 'replace', pageIdx: 0, textItemId: 'p0-t3', newText: 'Hello' });
    expect(m.ops()).toHaveLength(1);
    expect((m.ops()[0] as any).newText).toBe('Hello');
  });
});
