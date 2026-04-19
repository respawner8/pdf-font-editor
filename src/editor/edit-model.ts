import type { EditOp } from '@/shared/types';

export class EditModel {
  private stack: EditOp[] = [];
  private redoStack: EditOp[] = [];

  apply(op: EditOp): void {
    if (op.op === 'replace' && this.stack.length > 0) {
      const last = this.stack[this.stack.length - 1];
      if (last.op === 'replace' && last.textItemId === op.textItemId && last.pageIdx === op.pageIdx) {
        this.stack[this.stack.length - 1] = op;
        this.redoStack = [];
        return;
      }
    }
    this.stack.push(op);
    this.redoStack = [];
  }

  undo(): EditOp | undefined {
    const op = this.stack.pop();
    if (op) this.redoStack.push(op);
    return op;
  }

  redo(): EditOp | undefined {
    const op = this.redoStack.pop();
    if (op) this.stack.push(op);
    return op;
  }

  ops(): EditOp[] { return [...this.stack]; }

  clear(): void { this.stack = []; this.redoStack = []; }
}
