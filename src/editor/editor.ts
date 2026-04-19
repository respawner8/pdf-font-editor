import { loadPdfBytes, FileUrlAccessDeniedError } from './loader';
import { loadPdf, renderPage } from './renderer';
import { extractFontDescriptors } from '@/fonts/pdf-font-source';
import { resolveFont } from '@/fonts/matcher';
import { ensureLoaded as ensureCoreLoaded } from '@/fonts/core';
import { sha256Hex } from '@/shared/hash';
import { buildOverlay, enableAddTextMode, type PageWrap } from './overlay';
import { EditModel } from './edit-model';
import { buildToolbar } from './ui/toolbar';
import { writePdf } from './writer';
import { downloadPdf, suggestedFilename } from './download';
import { loadFontBytes } from './font-bytes';
import type { SubstituteFont, TextItem } from '@/shared/types';

const SIZE_WARN_MB = 100;

function showBanner(text: string, color = '#7a5a00') {
  const banner = document.createElement('div');
  banner.textContent = text;
  Object.assign(banner.style, { background: color, color: '#fff', padding: '6px 12px' });
  const toolbar = document.getElementById('toolbar');
  toolbar?.parentNode?.insertBefore(banner, toolbar);
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const src = params.get('src');
  const status = document.getElementById('status-bar')!;
  const pagesRoot = document.getElementById('pages')!;

  if (!src) { status.textContent = 'No PDF specified'; return; }

  status.textContent = `Loading ${src}…`;

  const bytes = await loadPdfBytes(src);

  if (bytes.byteLength > SIZE_WARN_MB * 1024 * 1024) {
    const mb = (bytes.byteLength / (1024 * 1024)).toFixed(0);
    if (!confirm(`This PDF is ${mb} MB. Loading large PDFs can be slow or may exhaust memory. Continue?`)) {
      status.textContent = 'Cancelled.';
      return;
    }
  }

  const hash = await sha256Hex(bytes);

  let loaded;
  try {
    loaded = await loadPdf(bytes);
  } catch (err: any) {
    if (err?.name === 'PasswordException') {
      const pwd = prompt('This PDF is password-protected. Enter password:');
      if (!pwd) { status.textContent = 'Password required.'; return; }
      try {
        loaded = await loadPdf(bytes, pwd);
      } catch {
        status.textContent = 'Wrong password. Reload to try again.';
        return;
      }
    } else {
      throw err;
    }
  }

  const fontMap = await extractFontDescriptors(loaded.doc);

  const substitutes = new Map<string, SubstituteFont>();
  let hadSystemFallback = false;
  for (const [ref, desc] of fontMap) {
    const sub = await resolveFont(desc);
    if (sub.source === 'system') hadSystemFallback = true;
    substitutes.set(ref, sub);
    if (sub.source === 'core') await ensureCoreLoaded(sub.family);
  }
  if (hadSystemFallback) {
    showBanner('⚠️ Some fonts approximated — network may be offline.');
  }

  const model = new EditModel();
  const substituteFor = (ref: string): SubstituteFont =>
    substitutes.get(ref) ?? { family: 'sans-serif', source: 'system', score: 1 };

  const pageWraps: PageWrap[] = [];
  for (let i = 0; i < loaded.numPages; i++) {
    const rendered = await renderPage(loaded, i);
    const pw = buildOverlay(rendered, substituteFor, {
      onReplace: (id, text) => model.apply({ op: 'replace', pageIdx: i, textItemId: id, newText: text }),
      onSelect:  (_id) => {},
      onDelete:  (id) => model.apply({ op: 'delete', pageIdx: i, textItemId: id }),
      onMove:    (id, dx, dy) => model.apply({ op: 'move', pageIdx: i, textItemId: id, dx, dy }),
      onResize:  (id, newFontSize) => model.apply({ op: 'resize', pageIdx: i, textItemId: id, newFontSize })
    });
    pagesRoot.appendChild(pw.wrap);
    pageWraps.push(pw);
  }

  const totalItems = pageWraps.reduce((n, pw) => n + pw.page.textItems.length, 0);
  if (totalItems === 0) {
    status.innerHTML = '<strong>This PDF has no editable text</strong> — it may be a scanned image. Editing is not supported for image-only PDFs.';
    return;
  }

  status.textContent = `${src} — ${loaded.numPages} page(s) — hash ${hash.slice(0, 12)}…`;

  buildToolbar({
    onUndo: () => model.undo(),
    onRedo: () => model.redo(),
    onAddText: () => {
      const first = pageWraps[0];
      if (!first) return;
      enableAddTextMode(first, (x, y) => {
        const text = prompt('Text to add:');
        if (!text) return;
        model.apply({
          op: 'insert', pageIdx: 0, x, y, text,
          fontFamily: 'Arimo', fontSize: 12, color: '#000000'
        });
        const el = document.createElement('span');
        el.className = 'text-item edited';
        el.contentEditable = 'plaintext-only';
        el.textContent = text;
        const scale = first.page.viewport.scale;
        Object.assign(el.style, {
          position: 'absolute',
          left: `${x * scale}px`,
          top:  `${(first.page.viewport.height / scale - y) * scale - 12 * scale}px`,
          fontFamily: `"Arimo", sans-serif`,
          fontSize: `${12 * scale}px`,
          color: '#000'
        });
        first.overlay.appendChild(el);
      });
    },
    onSave: async () => {
      status.textContent = 'Saving…';
      try {
        const textItemIndex = new Map<string, TextItem>();
        for (const pw of pageWraps) for (const t of pw.page.textItems) textItemIndex.set(t.id, t);
        const out = await writePdf(bytes, model.ops(), substitutes, textItemIndex, { loadFontBytes });
        await downloadPdf(out, suggestedFilename(src));
        status.textContent = 'Saved.';
      } catch (err) {
        status.textContent = `Save failed: ${(err as Error).message}`;
        console.error(err);
      }
    }
  });

  (window as any).__editModel = model;
}

boot().catch(err => {
  const status = document.getElementById('status-bar')!;
  if (err instanceof FileUrlAccessDeniedError) {
    status.innerHTML = 'File access denied. Open <a href="chrome://extensions" target="_blank" style="color:#4af">chrome://extensions</a>, find "PDF Font Editor", and enable "Allow access to file URLs".';
    return;
  }
  status.textContent = `Error: ${(err as Error).message}`;
  console.error(err);
});
