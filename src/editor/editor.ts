import { loadPdfBytes } from './loader';
import { loadPdf, renderPage } from './renderer';

async function boot() {
  const params = new URLSearchParams(location.search);
  const src = params.get('src');
  const status = document.getElementById('status-bar')!;
  const pagesRoot = document.getElementById('pages')!;

  if (!src) { status.textContent = 'No PDF specified'; return; }

  status.textContent = `Loading ${src}…`;
  try {
    const bytes = await loadPdfBytes(src);
    const loaded = await loadPdf(bytes);
    status.textContent = `${src} — ${loaded.numPages} page(s)`;
    for (let i = 0; i < loaded.numPages; i++) {
      const rendered = await renderPage(loaded, i);
      pagesRoot.appendChild(rendered.canvas);
    }
  } catch (err) {
    status.textContent = `Error: ${(err as Error).message}`;
    console.error(err);
  }
}
boot();
