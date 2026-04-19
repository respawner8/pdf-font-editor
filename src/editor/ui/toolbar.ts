export interface ToolbarCallbacks {
  onUndo(): void;
  onRedo(): void;
  onSave(): void;
  onAddText(): void;
}

export function buildToolbar(cb: ToolbarCallbacks): HTMLDivElement {
  const root = document.getElementById('toolbar') as HTMLDivElement;
  root.innerHTML = '';
  const btn = (label: string, on: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', on);
    root.appendChild(b);
    return b;
  };
  btn('Undo',     cb.onUndo);
  btn('Redo',     cb.onRedo);
  btn('Add text', cb.onAddText);
  btn('Save',     cb.onSave);
  return root;
}
