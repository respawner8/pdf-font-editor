import type { RenderedPage, SubstituteFont } from '@/shared/types';

export interface OverlayCallbacks {
  onReplace(textItemId: string, newText: string): void;
  onSelect(textItemId: string): void;
  onDelete(textItemId: string): void;
  onMove(textItemId: string, dx: number, dy: number): void;
  onResize(textItemId: string, newFontSize: number): void;
}

export interface PageWrap {
  wrap: HTMLDivElement;
  overlay: HTMLDivElement;
  page: RenderedPage;
}

export function buildOverlay(
  page: RenderedPage,
  substituteFor: (fontRef: string) => SubstituteFont,
  cb: OverlayCallbacks
): PageWrap {
  const wrap = document.createElement('div');
  wrap.className = 'page-wrap';
  wrap.style.position = 'relative';
  wrap.style.width = `${page.viewport.width}px`;
  wrap.style.height = `${page.viewport.height}px`;
  wrap.appendChild(page.canvas);

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  Object.assign(overlay.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  wrap.appendChild(overlay);

  const scale = page.viewport.scale;

  for (const it of page.textItems) {
    const sub = substituteFor(it.fontRef);
    const el = document.createElement('span');
    el.className = 'text-item';
    el.dataset.textItemId = it.id;
    el.dataset.origWidth = String(it.width * scale);
    el.contentEditable = 'plaintext-only';
    el.textContent = it.text;
    Object.assign(el.style, {
      position: 'absolute',
      left: `${it.x * scale}px`,
      top:  `${(page.viewport.height / scale - it.y) * scale - it.fontSize * scale}px`,
      fontFamily: `"${sub.family}", ${fallback(sub)}`,
      fontSize: `${it.fontSize * scale}px`,
      lineHeight: '1',
      whiteSpace: 'pre',
      pointerEvents: 'auto',
      color: 'transparent',
      caretColor: '#e53',
      outline: 'none'
    });

    el.addEventListener('focus', () => cb.onSelect(it.id));

    el.addEventListener('input', () => {
      cb.onReplace(it.id, el.textContent ?? '');
      const origW = parseFloat(el.dataset.origWidth ?? '0');
      const currentW = el.getBoundingClientRect().width;
      el.classList.toggle('overflow', currentW > origW + 2);
    });

    el.addEventListener('keydown', (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && (ev.key === 'Backspace' || ev.key === 'Delete')) {
        ev.preventDefault();
        cb.onDelete(it.id);
        el.remove();
        return;
      }
      if (ev.key === '[' || ev.key === ']') {
        ev.preventDefault();
        const delta = ev.key === ']' ? 1 : -1;
        const current = parseFloat(el.style.fontSize) / scale;
        const next = Math.max(4, current + delta);
        el.style.fontSize = `${next * scale}px`;
        cb.onResize(it.id, next);
      }
    });

    el.addEventListener('mousedown', (ev) => {
      if (!ev.altKey) return;
      ev.preventDefault();
      const ox = el.offsetLeft;
      const oy = el.offsetTop;
      const mx = ev.clientX;
      const my = ev.clientY;
      const onMove = (mv: MouseEvent) => {
        el.style.left = `${ox + (mv.clientX - mx)}px`;
        el.style.top  = `${oy + (mv.clientY - my)}px`;
      };
      const onUp = (mv: MouseEvent) => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        const ddx = (mv.clientX - mx) / scale;
        const ddy = -(mv.clientY - my) / scale;
        cb.onMove(it.id, ddx, ddy);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    el.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      void import('./ui/context-menu').then(({ showContextMenu }) => {
        showContextMenu(ev.clientX, ev.clientY, [
          { label: 'Shrink to fit', on: () => {
            const origW = parseFloat(el.dataset.origWidth ?? '0');
            const currentW = el.getBoundingClientRect().width;
            if (currentW <= origW) return;
            const currentSize = parseFloat(el.style.fontSize);
            const newSize = currentSize * (origW / currentW);
            el.style.fontSize = `${newSize}px`;
            el.classList.remove('overflow');
            cb.onResize(it.id, newSize / scale);
          }}
        ]);
      });
    });

    overlay.appendChild(el);
  }

  return { wrap, overlay, page };
}

export function enableAddTextMode(
  pw: PageWrap,
  onInsert: (x: number, y: number) => void
): () => void {
  pw.wrap.style.cursor = 'text';
  const listener = (ev: MouseEvent) => {
    const rect = pw.wrap.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    const scale = pw.page.viewport.scale;
    const x = px / scale;
    const y = (pw.page.viewport.height / scale) - (py / scale);
    onInsert(x, y);
  };
  pw.wrap.addEventListener('click', listener, { once: true });
  return () => { pw.wrap.style.cursor = ''; pw.wrap.removeEventListener('click', listener); };
}

function fallback(sub: SubstituteFont): string {
  if (sub.source === 'system') return sub.family;
  const lower = sub.family.toLowerCase();
  return lower.includes('serif') ? 'serif' : lower.includes('mono') ? 'monospace' : 'sans-serif';
}
