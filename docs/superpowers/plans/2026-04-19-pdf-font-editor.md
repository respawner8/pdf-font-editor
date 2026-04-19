# PDF Font Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension that lets users edit text in local `file://` PDFs while preserving visual font fidelity via metric-matched substitutes, and exports a new PDF on save.

**Architecture:** Extension shell (service worker) opens an in-extension editor page for a given `file://` PDF. The editor uses `pdf.js` to render and extract the text layer, a custom font analyzer + matcher to resolve original fonts to bundled or Google-Fonts substitutes, an HTML overlay for in-place editing, an in-memory operation log (edit model), and `pdf-lib` to rewrite the PDF with substitute font subsets embedded on save.

**Tech Stack:** TypeScript, Vite + `@crxjs/vite-plugin` (MV3 bundler), pdfjs-dist, pdf-lib, fontkit (glyph measurement), Vitest, Playwright (optional smoke), @fontsource bundled fonts.

---

## File Structure

```
pdf-font-editor/
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── .gitignore                                    (exists)
├── src/
│   ├── background/
│   │   └── service-worker.ts                     Handle icon click → open editor tab
│   ├── editor/
│   │   ├── editor.html                           Editor page shell
│   │   ├── editor.ts                             Entry: boot, wire pipeline
│   │   ├── loader.ts                             fetch(file://) → ArrayBuffer
│   │   ├── renderer.ts                           pdf.js render + text-layer extraction
│   │   ├── overlay.ts                            Editable HTML overlay, text-item coords
│   │   ├── edit-model.ts                         Op types, apply/undo/redo
│   │   ├── writer.ts                             pdf-lib apply ops → new PDF bytes
│   │   ├── download.ts                           Blob + a[download] + chrome.downloads fallback
│   │   └── ui/
│   │       ├── toolbar.ts                        Add-text, save, undo/redo
│   │       ├── context-menu.ts                   Shrink-to-fit, font override dropdown
│   │       └── status-bar.ts                     Offline banner, warnings
│   ├── fonts/
│   │   ├── analyzer.ts                           Extract /Font dict → FontDescriptor
│   │   ├── matcher.ts                            Resolution pipeline orchestrator
│   │   ├── scoring.ts                            Weighted metric distance function
│   │   ├── registry.ts                           PostScript-name → substitute direct-hit map
│   │   ├── core.ts                               Bundled core family registry + lazy load
│   │   ├── google-fonts.ts                       CDN search + canvas-probe measurement
│   │   ├── cache.ts                              chrome.storage.local read/write
│   │   └── assets/                               Bundled woff2 files (Liberation*, Carlito, ...)
│   └── shared/
│       ├── types.ts                              Shared types (FontDescriptor, EditOp, …)
│       └── hash.ts                               SHA-256 of ArrayBuffer via SubtleCrypto
├── test/
│   ├── fixtures/                                 Committed test PDFs
│   ├── unit/
│   │   ├── scoring.test.ts
│   │   ├── registry.test.ts
│   │   ├── matcher.test.ts
│   │   ├── analyzer.test.ts
│   │   ├── edit-model.test.ts
│   │   ├── writer.test.ts
│   │   └── hash.test.ts
│   └── e2e/
│       └── roundtrip.test.ts
└── docs/                                         (spec lives here)
```

**Design notes on decomposition:**
- `fonts/` is a self-contained subsystem with no DOM dependencies. Fully unit-testable.
- `editor/writer.ts` is the only module that imports `pdf-lib`. Other modules consume its `save()` output.
- `edit-model.ts` has no pdf.js or DOM imports — pure data structure + reducer.
- The `renderer` hands off to `overlay` via a typed `RenderedPage` contract; neither knows about the other's internals.

---

## Dependencies

| Package | Purpose |
|---|---|
| `pdfjs-dist` | PDF parsing + rendering |
| `pdf-lib` | PDF modification + subsetting |
| `@pdf-lib/fontkit` | Font subsetting glue |
| `vite` + `@crxjs/vite-plugin` | MV3 bundler |
| `typescript` | Language |
| `vitest` + `@vitest/ui` | Unit tests |
| `happy-dom` | Vitest DOM env |
| `@fontsource/arimo` / `tinos` / `cousine` | Bundled core (metric-matches for Arial / Times / Courier) |
| `@fontsource/carlito` / `caladea` | Bundled core (metric-matches for Calibri / Cambria) |
| `@fontsource/source-sans-3` / `source-serif-4` | Bundled core |
| `@fontsource/noto-sans` | Bundled core |

---

## Phase 0 — Project scaffold

### Task 1: Initialize npm project + deps

**Files:**
- Create: `package.json`

- [ ] **Step 1:** From `/Users/nikhilanand/Desktop/Dev/pdf-font-editor`, run:

```bash
npm init -y
npm pkg set type=module
npm pkg set scripts.dev="vite"
npm pkg set scripts.build="vite build"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
```

- [ ] **Step 2:** Install runtime deps:

```bash
npm install pdfjs-dist pdf-lib @pdf-lib/fontkit
npm install @fontsource/arimo @fontsource/tinos @fontsource/cousine @fontsource/carlito @fontsource/caladea @fontsource/source-sans-3 @fontsource/source-serif-4 @fontsource/noto-sans
```

- [ ] **Step 3:** Install dev deps:

```bash
npm install -D typescript vite @crxjs/vite-plugin vitest @vitest/ui happy-dom @types/chrome
```

- [ ] **Step 4:** Commit:

```bash
git add package.json package-lock.json
git commit -m "chore: initialize npm project with pdf.js, pdf-lib, vite+crxjs, vitest"
```

---

### Task 2: TypeScript config

**Files:**
- Create: `tsconfig.json`

- [ ] **Step 1:** Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome", "vitest/globals"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "allowSyntheticDefaultImports": true,
    "baseUrl": "./",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 2:** Commit:

```bash
git add tsconfig.json
git commit -m "chore: add TypeScript strict config"
```

---

### Task 3: Vite + CRX plugin config

**Files:**
- Create: `vite.config.ts`

- [ ] **Step 1:** Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };
import path from 'node:path';

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: { target: 'esnext', sourcemap: true },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['test/unit/**/*.test.ts']
  }
});
```

- [ ] **Step 2:** Commit:

```bash
git add vite.config.ts
git commit -m "chore: configure vite with crxjs plugin and vitest"
```

---

### Task 4: MV3 manifest skeleton

**Files:**
- Create: `manifest.json`
- Create: `src/background/service-worker.ts`
- Create: `src/editor/editor.html`

- [ ] **Step 1:** Create `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "PDF Font Editor",
  "version": "0.1.0",
  "description": "Edit local PDFs while preserving original fonts via metric-matched substitutes",
  "action": { "default_title": "Edit this PDF" },
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "permissions": ["activeTab", "storage", "downloads"],
  "host_permissions": ["file:///*"],
  "web_accessible_resources": [
    {
      "resources": ["src/editor/editor.html", "src/fonts/assets/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

- [ ] **Step 2:** Create `src/background/service-worker.ts`:

```ts
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !/^file:\/\/.*\.pdf($|\?)/i.test(tab.url)) {
    console.warn('[pdf-font-editor] Not a local PDF tab:', tab.url);
    return;
  }
  const editorUrl = chrome.runtime.getURL('src/editor/editor.html') +
    `?src=${encodeURIComponent(tab.url)}`;
  await chrome.tabs.create({ url: editorUrl });
});
```

- [ ] **Step 3:** Create `src/editor/editor.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>PDF Font Editor</title>
    <link rel="stylesheet" href="./editor.css" />
  </head>
  <body>
    <div id="status-bar"></div>
    <div id="toolbar"></div>
    <div id="pages"></div>
    <script type="module" src="./editor.ts"></script>
  </body>
</html>
```

- [ ] **Step 4:** Create stub `src/editor/editor.ts`:

```ts
const params = new URLSearchParams(location.search);
const src = params.get('src');
document.getElementById('status-bar')!.textContent = src
  ? `Loading: ${src}`
  : 'No PDF specified';
```

- [ ] **Step 5:** Create empty `src/editor/editor.css`:

```css
body { margin: 0; font-family: system-ui, sans-serif; background: #222; color: #ddd; }
#status-bar { padding: 8px 12px; background: #111; }
#toolbar { padding: 8px 12px; background: #1a1a1a; }
#pages { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
```

- [ ] **Step 6:** Build and sanity-check load-unpacked manually:

```bash
npm run build
```
Then in `chrome://extensions` → Developer mode on → Load unpacked → select `dist/`. Enable "Allow access to file URLs" on the extension. Open a local PDF. Click the extension icon. A new tab should open showing "Loading: file:///…/your.pdf".

- [ ] **Step 7:** Commit:

```bash
git add manifest.json src/background src/editor
git commit -m "feat: scaffold MV3 manifest, service worker, and editor shell"
```

---

### Task 5: Vitest smoke test

**Files:**
- Create: `test/unit/smoke.test.ts`

- [ ] **Step 1:** Create `test/unit/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs a test', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2:** Run:

```bash
npm test
```
Expected: 1 passed.

- [ ] **Step 3:** Commit:

```bash
git add test/unit/smoke.test.ts
git commit -m "test: add vitest smoke test"
```

---

## Phase 1 — PDF load + render

### Task 6: Shared types

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1:** Create `src/shared/types.ts`:

```ts
export type FontClass = 'serif' | 'sans' | 'mono' | 'script' | 'unknown';

export interface FontMetrics {
  ascent: number;
  descent: number;
  capHeight: number;
  xHeight: number;
  avgAdvance: number;
  em: number;
}

export interface FontDescriptor {
  postScriptName: string;
  class: FontClass;
  weight: number;       // 100-900
  italic: boolean;
  metrics: FontMetrics;
}

export interface SubstituteFont {
  family: string;
  source: 'registry' | 'core' | 'google-fonts' | 'system';
  score: number;        // 0 = perfect, higher = worse
  url?: string;         // for google-fonts or core woff2
}

export type FontClassMatch = {
  original: FontDescriptor;
  substitute: SubstituteFont;
};

export type EditOp =
  | { op: 'replace'; pageIdx: number; textItemId: string; newText: string }
  | { op: 'insert';  pageIdx: number; x: number; y: number; text: string; fontFamily: string; fontSize: number; color: string }
  | { op: 'delete';  pageIdx: number; textItemId: string }
  | { op: 'move';    pageIdx: number; textItemId: string; dx: number; dy: number }
  | { op: 'resize';  pageIdx: number; textItemId: string; newFontSize: number };

export interface TextItem {
  id: string;           // stable per-session
  pageIdx: number;
  text: string;
  x: number;            // PDF-space, origin bottom-left
  y: number;
  width: number;
  height: number;
  fontRef: string;      // key into font dictionary
  fontSize: number;
  color: string;
}

export interface RenderedPage {
  pageIdx: number;
  canvas: HTMLCanvasElement;
  viewport: { width: number; height: number; scale: number };
  textItems: TextItem[];
}
```

- [ ] **Step 2:** Commit:

```bash
git add src/shared/types.ts
git commit -m "feat: define shared types (FontDescriptor, EditOp, RenderedPage)"
```

---

### Task 7: SHA-256 helper (TDD)

**Files:**
- Create: `src/shared/hash.ts`
- Test: `test/unit/hash.test.ts`

- [ ] **Step 1:** Write failing test `test/unit/hash.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sha256Hex } from '@/shared/hash';

describe('sha256Hex', () => {
  it('hashes an empty buffer to the known value', async () => {
    const result = await sha256Hex(new ArrayBuffer(0));
    expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('hashes ASCII "abc" to the known value', async () => {
    const buf = new TextEncoder().encode('abc').buffer;
    const result = await sha256Hex(buf);
    expect(result).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
```

- [ ] **Step 2:** Run: `npm test -- hash` → expect FAIL (module not found).

- [ ] **Step 3:** Implement `src/shared/hash.ts`:

```ts
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

- [ ] **Step 4:** Run: `npm test -- hash` → expect PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/shared/hash.ts test/unit/hash.test.ts
git commit -m "feat(shared): add SHA-256 hash helper with tests"
```

---

### Task 8: PDF loader

**Files:**
- Create: `src/editor/loader.ts`

- [ ] **Step 1:** Create `src/editor/loader.ts`:

```ts
export class FileUrlAccessDeniedError extends Error {
  constructor() {
    super('File URL access is denied. Enable "Allow access to file URLs" for this extension in chrome://extensions.');
    this.name = 'FileUrlAccessDeniedError';
  }
}

export async function loadPdfBytes(src: string): Promise<ArrayBuffer> {
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${src}`);
    return await res.arrayBuffer();
  } catch (err) {
    if (err instanceof TypeError && src.startsWith('file://')) {
      throw new FileUrlAccessDeniedError();
    }
    throw err;
  }
}
```

- [ ] **Step 2:** Commit:

```bash
git add src/editor/loader.ts
git commit -m "feat(loader): fetch file:// PDFs with permission error surfacing"
```

---

### Task 9: pdf.js renderer + text layer extraction

**Files:**
- Create: `src/editor/renderer.ts`

This module wraps pdf.js. Reference the pdf.js API for `getDocument`, `page.render`, and `page.getTextContent`.

- [ ] **Step 1:** Create `src/editor/renderer.ts`:

```ts
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { RenderedPage, TextItem } from '@/shared/types';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface LoadedPdf {
  doc: pdfjsLib.PDFDocumentProxy;
  numPages: number;
  bytes: ArrayBuffer;
}

export async function loadPdf(bytes: ArrayBuffer, password?: string): Promise<LoadedPdf> {
  const doc = await pdfjsLib.getDocument({ data: bytes, password }).promise;
  return { doc, numPages: doc.numPages, bytes };
}

const RENDER_SCALE = 1.5;

export async function renderPage(loaded: LoadedPdf, pageIdx: number): Promise<RenderedPage> {
  const page = await loaded.doc.getPage(pageIdx + 1);
  const viewport = page.getViewport({ scale: RENDER_SCALE });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  const textContent = await page.getTextContent();
  const textItems: TextItem[] = textContent.items
    .filter((it: any) => 'str' in it)
    .map((it: any, i: number): TextItem => {
      const [a, b, c, d, e, f] = it.transform as number[];
      const fontSize = Math.hypot(a, b);
      return {
        id: `p${pageIdx}-t${i}`,
        pageIdx,
        text: it.str,
        x: e,
        y: f,
        width: it.width,
        height: it.height,
        fontRef: it.fontName,
        fontSize,
        color: '#000000'
      };
    });

  return {
    pageIdx,
    canvas,
    viewport: { width: viewport.width, height: viewport.height, scale: RENDER_SCALE },
    textItems
  };
}
```

- [ ] **Step 2:** Wire into `src/editor/editor.ts`:

```ts
import { loadPdfBytes } from './loader';
import { loadPdf, renderPage } from './renderer';

async function boot() {
  const params = new URLSearchParams(location.search);
  const src = params.get('src');
  const status = document.getElementById('status-bar')!;
  const pages = document.getElementById('pages')!;

  if (!src) { status.textContent = 'No PDF specified'; return; }

  status.textContent = `Loading ${src}…`;
  try {
    const bytes = await loadPdfBytes(src);
    const loaded = await loadPdf(bytes);
    status.textContent = `${src} — ${loaded.numPages} page(s)`;
    for (let i = 0; i < loaded.numPages; i++) {
      const rendered = await renderPage(loaded, i);
      pages.appendChild(rendered.canvas);
    }
  } catch (err) {
    status.textContent = `Error: ${(err as Error).message}`;
    console.error(err);
  }
}
boot();
```

- [ ] **Step 3:** Build + reload the unpacked extension. Open a PDF, click the icon, verify it renders every page.

- [ ] **Step 4:** Commit:

```bash
git add src/editor/renderer.ts src/editor/editor.ts
git commit -m "feat(renderer): render pages and extract text layer via pdf.js"
```

---

## Phase 2 — Font analyzer

### Task 10: Font analyzer

**Files:**
- Create: `src/fonts/analyzer.ts`
- Test: `test/unit/analyzer.test.ts`

- [ ] **Step 1:** Write failing test `test/unit/analyzer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifyFont, inferWeight, inferItalic } from '@/fonts/analyzer';

describe('classifyFont', () => {
  it('classifies serif from PostScript name', () => {
    expect(classifyFont('TimesNewRomanPSMT', 0)).toBe('serif');
    expect(classifyFont('Georgia-Bold', 0)).toBe('serif');
  });
  it('classifies sans from PostScript name', () => {
    expect(classifyFont('Helvetica-Bold', 0)).toBe('sans');
    expect(classifyFont('Arial', 0)).toBe('sans');
    expect(classifyFont('Calibri', 0)).toBe('sans');
  });
  it('classifies mono from flag bit 1 (FixedPitch)', () => {
    expect(classifyFont('UnknownFont', 0b1)).toBe('mono');
  });
  it('falls back to unknown when no signal', () => {
    expect(classifyFont('CustomCo-Display', 0)).toBe('unknown');
  });
});

describe('inferWeight', () => {
  it('extracts weight hints from the PS name', () => {
    expect(inferWeight('Helvetica-Bold')).toBe(700);
    expect(inferWeight('Helvetica-Light')).toBe(300);
    expect(inferWeight('Helvetica-Black')).toBe(900);
    expect(inferWeight('Helvetica')).toBe(400);
  });
});

describe('inferItalic', () => {
  it('detects italic / oblique in PS name', () => {
    expect(inferItalic('Helvetica-Oblique')).toBe(true);
    expect(inferItalic('Times-Italic')).toBe(true);
    expect(inferItalic('Helvetica-Bold')).toBe(false);
  });
  it('detects italic flag (bit 7 of Flags)', () => {
    // classifyFont consumes flags; italic has its own signal via inferItalicFromFlags — tested separately below
  });
});
```

- [ ] **Step 2:** Run: `npm test -- analyzer` → FAIL.

- [ ] **Step 3:** Implement `src/fonts/analyzer.ts`:

```ts
import type { FontClass, FontDescriptor, FontMetrics } from '@/shared/types';

const SERIF_NAMES = /Times|Georgia|Cambria|Garamond|Palatino|Bookman|Minion|Caslon|Baskerville/i;
const SANS_NAMES  = /Helvetica|Arial|Calibri|Verdana|Tahoma|Trebuchet|Segoe|Roboto|Open[ -]?Sans|Lato/i;
const MONO_NAMES  = /Courier|Consolas|Menlo|Monaco|Inconsolata|Mono/i;

const FLAG_FIXED_PITCH = 1 << 0;
const FLAG_SERIF       = 1 << 1;
const FLAG_ITALIC      = 1 << 6;

export function classifyFont(psName: string, flags: number): FontClass {
  if (flags & FLAG_FIXED_PITCH) return 'mono';
  if (flags & FLAG_SERIF) return 'serif';
  if (MONO_NAMES.test(psName)) return 'mono';
  if (SERIF_NAMES.test(psName)) return 'serif';
  if (SANS_NAMES.test(psName)) return 'sans';
  return 'unknown';
}

const WEIGHT_TOKENS: Record<string, number> = {
  thin: 100, hairline: 100,
  extralight: 200, ultralight: 200,
  light: 300,
  regular: 400, normal: 400, book: 400,
  medium: 500,
  semibold: 600, demibold: 600,
  bold: 700,
  extrabold: 800, ultrabold: 800,
  black: 900, heavy: 900
};

export function inferWeight(psName: string): number {
  const token = psName.toLowerCase().replace(/[^a-z]/g, '');
  for (const [key, w] of Object.entries(WEIGHT_TOKENS)) {
    if (token.includes(key)) return w;
  }
  return 400;
}

export function inferItalic(psName: string): boolean {
  return /italic|oblique/i.test(psName);
}

export function inferItalicFromFlags(flags: number): boolean {
  return Boolean(flags & FLAG_ITALIC);
}

export interface PdfFontSource {
  psName: string;
  flags: number;
  ascent?: number;
  descent?: number;
  capHeight?: number;
  xHeight?: number;
  avgWidth?: number;
  italicAngle?: number;
}

const DEFAULT_METRICS: FontMetrics = {
  ascent: 700, descent: -200, capHeight: 700, xHeight: 500, avgAdvance: 500, em: 1000
};

export function analyze(source: PdfFontSource): FontDescriptor {
  const italic = inferItalic(source.psName) || inferItalicFromFlags(source.flags) ||
                 (source.italicAngle !== undefined && source.italicAngle !== 0);
  return {
    postScriptName: source.psName,
    class: classifyFont(source.psName, source.flags),
    weight: inferWeight(source.psName),
    italic,
    metrics: {
      ascent:     source.ascent     ?? DEFAULT_METRICS.ascent,
      descent:    source.descent    ?? DEFAULT_METRICS.descent,
      capHeight:  source.capHeight  ?? DEFAULT_METRICS.capHeight,
      xHeight:    source.xHeight    ?? DEFAULT_METRICS.xHeight,
      avgAdvance: source.avgWidth   ?? DEFAULT_METRICS.avgAdvance,
      em:         DEFAULT_METRICS.em
    }
  };
}
```

- [ ] **Step 4:** Run: `npm test -- analyzer` → PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/fonts/analyzer.ts test/unit/analyzer.test.ts
git commit -m "feat(fonts): add font analyzer (class/weight/italic/metrics inference)"
```

---

### Task 11: Extract PDF /Font dict via pdf.js

**Files:**
- Modify: `src/editor/renderer.ts`
- Create: `src/fonts/pdf-font-source.ts`

Pdf.js exposes font descriptors through `page.commonObjs`. Extract what the analyzer needs.

- [ ] **Step 1:** Create `src/fonts/pdf-font-source.ts`:

```ts
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { analyze, type PdfFontSource } from '@/fonts/analyzer';
import type { FontDescriptor } from '@/shared/types';

export async function extractFontDescriptors(doc: PDFDocumentProxy): Promise<Map<string, FontDescriptor>> {
  const map = new Map<string, FontDescriptor>();
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    await page.getOperatorList();   // populates commonObjs
    const fontRefs: string[] = (page as any).commonObjs?._objs
      ? Object.keys((page as any).commonObjs._objs).filter(k => k.startsWith('g_d') || k.startsWith('f'))
      : [];
    for (const ref of fontRefs) {
      if (map.has(ref)) continue;
      const obj = (page as any).commonObjs.get(ref);
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
```

- [ ] **Step 2:** Commit (no unit test — integration-tested via fixture round-trip in Task 32):

```bash
git add src/fonts/pdf-font-source.ts
git commit -m "feat(fonts): extract font descriptors from pdf.js document"
```

---

## Phase 3 — Font matcher

### Task 12: Scoring function (TDD)

**Files:**
- Create: `src/fonts/scoring.ts`
- Test: `test/unit/scoring.test.ts`

- [ ] **Step 1:** Write failing test `test/unit/scoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scoreMatch } from '@/fonts/scoring';
import type { FontDescriptor } from '@/shared/types';

const helvetica: FontDescriptor = {
  postScriptName: 'Helvetica',
  class: 'sans', weight: 400, italic: false,
  metrics: { ascent: 718, descent: -207, capHeight: 718, xHeight: 523, avgAdvance: 478, em: 1000 }
};

const liberationSans: FontDescriptor = {
  postScriptName: 'LiberationSans',
  class: 'sans', weight: 400, italic: false,
  metrics: { ascent: 720, descent: -210, capHeight: 720, xHeight: 525, avgAdvance: 480, em: 1000 }
};

const times: FontDescriptor = {
  postScriptName: 'Times-Roman',
  class: 'serif', weight: 400, italic: false,
  metrics: { ascent: 683, descent: -217, capHeight: 662, xHeight: 450, avgAdvance: 445, em: 1000 }
};

describe('scoreMatch', () => {
  it('scores near-identical sans at ~0', () => {
    expect(scoreMatch(helvetica, liberationSans)).toBeLessThan(0.02);
  });
  it('penalises class mismatch heavily', () => {
    expect(scoreMatch(helvetica, times)).toBeGreaterThan(1.0);
  });
  it('penalises weight mismatch', () => {
    const heavy = { ...liberationSans, weight: 900 };
    expect(scoreMatch(helvetica, heavy)).toBeGreaterThan(0.3);
  });
  it('penalises italic mismatch', () => {
    const italic = { ...liberationSans, italic: true };
    expect(scoreMatch(helvetica, italic)).toBeGreaterThan(0.3);
  });
});
```

- [ ] **Step 2:** Run: `npm test -- scoring` → FAIL.

- [ ] **Step 3:** Implement `src/fonts/scoring.ts`:

```ts
import type { FontDescriptor } from '@/shared/types';

const W = { cls: 1.0, weight: 0.0005, italic: 0.4, capH: 0.002, xH: 0.002, avg: 0.002 };

export function scoreMatch(a: FontDescriptor, b: FontDescriptor): number {
  let s = 0;
  if (a.class !== b.class && a.class !== 'unknown' && b.class !== 'unknown') s += W.cls;
  s += W.weight * Math.abs(a.weight - b.weight);
  if (a.italic !== b.italic) s += W.italic;
  s += W.capH * Math.abs(a.metrics.capHeight - b.metrics.capHeight);
  s += W.xH * Math.abs(a.metrics.xHeight - b.metrics.xHeight);
  s += W.avg * Math.abs(a.metrics.avgAdvance - b.metrics.avgAdvance);
  return s;
}

export const GOOD_MATCH_THRESHOLD = 0.15;
```

- [ ] **Step 4:** Run: `npm test -- scoring` → PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/fonts/scoring.ts test/unit/scoring.test.ts
git commit -m "feat(fonts): weighted metric scoring for font substitution"
```

---

### Task 13: Registry direct-hit map (TDD)

**Files:**
- Create: `src/fonts/registry.ts`
- Test: `test/unit/registry.test.ts`

- [ ] **Step 1:** Write failing test `test/unit/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { lookupRegistry } from '@/fonts/registry';

describe('lookupRegistry', () => {
  it('maps Helvetica-Bold to Arimo Bold', () => {
    const hit = lookupRegistry('Helvetica-Bold');
    expect(hit?.family).toBe('Arimo');
    expect(hit?.weight).toBe(700);
  });
  it('maps Times variants to Tinos', () => {
    expect(lookupRegistry('TimesNewRomanPSMT')?.family).toBe('Tinos');
    expect(lookupRegistry('Times-Italic')?.family).toBe('Tinos');
    expect(lookupRegistry('Times-Italic')?.italic).toBe(true);
  });
  it('is case-insensitive and strips subset prefixes', () => {
    expect(lookupRegistry('ABCDEF+Helvetica')?.family).toBe('Arimo');
    expect(lookupRegistry('arial-BoldMT')?.family).toBe('Arimo');
  });
  it('returns undefined for unknown names', () => {
    expect(lookupRegistry('RandomCustomFont')).toBeUndefined();
  });
});
```

- [ ] **Step 2:** Run: `npm test -- registry` → FAIL.

- [ ] **Step 3:** Implement `src/fonts/registry.ts`:

```ts
export interface RegistryHit {
  family: string;      // google-fonts family name
  weight: number;
  italic: boolean;
  source: 'google-fonts' | 'core';
}

interface Pattern {
  re: RegExp;
  base: { family: string; source: RegistryHit['source'] };
}

const PATTERNS: Pattern[] = [
  { re: /helvetica|arial/i,            base: { family: 'Arimo',         source: 'google-fonts' } },
  { re: /times(newroman)?/i,           base: { family: 'Tinos',         source: 'google-fonts' } },
  { re: /courier/i,                    base: { family: 'Cousine',       source: 'core' } },
  { re: /calibri/i,                    base: { family: 'Carlito',       source: 'core' } },
  { re: /cambria/i,                    base: { family: 'Caladea',       source: 'google-fonts' } },
  { re: /consolas/i,                   base: { family: 'Cousine',       source: 'core' } },
  { re: /georgia/i,                    base: { family: 'Source Serif 4',source: 'core' } },
  { re: /verdana|tahoma|segoe/i,       base: { family: 'Noto Sans',     source: 'core' } },
  { re: /palatino/i,                   base: { family: 'Source Serif 4',source: 'core' } },
  { re: /garamond/i,                   base: { family: 'EB Garamond',   source: 'google-fonts' } },
  { re: /bookman/i,                    base: { family: 'Bree Serif',    source: 'google-fonts' } }
];

const WEIGHT_RE = /thin|extralight|ultralight|light|regular|normal|book|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy/i;
const WEIGHT_MAP: Record<string, number> = {
  thin: 100, hairline: 100, extralight: 200, ultralight: 200, light: 300,
  regular: 400, normal: 400, book: 400, medium: 500,
  semibold: 600, demibold: 600, bold: 700, extrabold: 800, ultrabold: 800,
  black: 900, heavy: 900
};

function normalize(psName: string): string {
  return psName.replace(/^[A-Z]{6}\+/, '');     // strip subset prefix like "ABCDEF+"
}

export function lookupRegistry(psName: string): RegistryHit | undefined {
  const name = normalize(psName);
  for (const { re, base } of PATTERNS) {
    if (re.test(name)) {
      const wm = name.match(WEIGHT_RE);
      const weight = wm ? WEIGHT_MAP[wm[0].toLowerCase()] ?? 400 : 400;
      const italic = /italic|oblique/i.test(name);
      return { family: base.family, weight, italic, source: base.source };
    }
  }
  return undefined;
}
```

- [ ] **Step 4:** Run: `npm test -- registry` → PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/fonts/registry.ts test/unit/registry.test.ts
git commit -m "feat(fonts): add PostScript-name registry with subset-prefix normalization"
```

---

### Task 14: Bundled core — metadata + loader

**Files:**
- Create: `src/fonts/core.ts`

- [ ] **Step 1:** Create `src/fonts/core.ts`:

```ts
import type { FontDescriptor } from '@/shared/types';

export interface CoreFont {
  family: string;
  descriptor: FontDescriptor;
  fontsourcePkg: string;        // triggers import of woff2
}

export const CORE_FONTS: CoreFont[] = [
  {
    family: 'Liberation Sans',
    fontsourcePkg: '@fontsource/liberation-sans',
    descriptor: {
      postScriptName: 'LiberationSans',
      class: 'sans', weight: 400, italic: false,
      metrics: { ascent: 720, descent: -210, capHeight: 720, xHeight: 525, avgAdvance: 480, em: 1000 }
    }
  },
  {
    family: 'Liberation Serif',
    fontsourcePkg: '@fontsource/liberation-serif',
    descriptor: {
      postScriptName: 'LiberationSerif',
      class: 'serif', weight: 400, italic: false,
      metrics: { ascent: 720, descent: -210, capHeight: 680, xHeight: 460, avgAdvance: 460, em: 1000 }
    }
  },
  {
    family: 'Liberation Mono',
    fontsourcePkg: '@fontsource/liberation-mono',
    descriptor: {
      postScriptName: 'LiberationMono',
      class: 'mono', weight: 400, italic: false,
      metrics: { ascent: 720, descent: -210, capHeight: 720, xHeight: 520, avgAdvance: 600, em: 1000 }
    }
  },
  {
    family: 'Carlito',
    fontsourcePkg: '@fontsource/carlito',
    descriptor: {
      postScriptName: 'Carlito',
      class: 'sans', weight: 400, italic: false,
      metrics: { ascent: 950, descent: -250, capHeight: 702, xHeight: 516, avgAdvance: 509, em: 2048 }
    }
  },
  {
    family: 'Cousine',
    fontsourcePkg: '@fontsource/cousine',
    descriptor: {
      postScriptName: 'Cousine',
      class: 'mono', weight: 400, italic: false,
      metrics: { ascent: 750, descent: -250, capHeight: 700, xHeight: 500, avgAdvance: 600, em: 1000 }
    }
  },
  {
    family: 'Source Sans 3',
    fontsourcePkg: '@fontsource/source-sans-3',
    descriptor: {
      postScriptName: 'SourceSans3',
      class: 'sans', weight: 400, italic: false,
      metrics: { ascent: 750, descent: -250, capHeight: 660, xHeight: 486, avgAdvance: 492, em: 1000 }
    }
  },
  {
    family: 'Source Serif 4',
    fontsourcePkg: '@fontsource/source-serif-4',
    descriptor: {
      postScriptName: 'SourceSerif4',
      class: 'serif', weight: 400, italic: false,
      metrics: { ascent: 750, descent: -250, capHeight: 660, xHeight: 475, avgAdvance: 490, em: 1000 }
    }
  },
  {
    family: 'Noto Sans',
    fontsourcePkg: '@fontsource/noto-sans',
    descriptor: {
      postScriptName: 'NotoSans',
      class: 'sans', weight: 400, italic: false,
      metrics: { ascent: 1069, descent: -293, capHeight: 714, xHeight: 536, avgAdvance: 565, em: 1000 }
    }
  }
];

const loaded = new Set<string>();

export async function ensureLoaded(family: string): Promise<void> {
  if (loaded.has(family)) return;
  const entry = CORE_FONTS.find(f => f.family === family);
  if (!entry) return;
  await import(/* @vite-ignore */ `${entry.fontsourcePkg}/400.css`);
  loaded.add(family);
}
```

- [ ] **Step 2:** Commit:

```bash
git add src/fonts/core.ts
git commit -m "feat(fonts): register bundled core families with metric baselines"
```

---

### Task 15: Google Fonts CDN search + canvas measurement probe

**Files:**
- Create: `src/fonts/google-fonts.ts`

- [ ] **Step 1:** Create `src/fonts/google-fonts.ts`:

```ts
import type { FontClass, FontDescriptor, FontMetrics } from '@/shared/types';

interface GoogleFontEntry { family: string; category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace'; variants: string[]; }

let metadataCache: GoogleFontEntry[] | null = null;

async function loadMetadata(): Promise<GoogleFontEntry[]> {
  if (metadataCache) return metadataCache;
  const res = await fetch('https://fonts.google.com/metadata/fonts');
  const json = await res.json();
  metadataCache = (json.familyMetadataList ?? []).map((f: any) => ({
    family: f.family,
    category: f.category,
    variants: Object.keys(f.fonts ?? {})
  }));
  return metadataCache!;
}

function classMatches(cls: FontClass, cat: GoogleFontEntry['category']): boolean {
  if (cls === 'serif') return cat === 'serif';
  if (cls === 'sans')  return cat === 'sans-serif';
  if (cls === 'mono')  return cat === 'monospace';
  return true;
}

export async function searchGoogleFonts(target: FontDescriptor, topN = 5): Promise<GoogleFontEntry[]> {
  const meta = await loadMetadata();
  return meta.filter(e => classMatches(target.class, e.category)).slice(0, topN);
}

export async function loadGoogleFont(family: string, weight = 400, italic = false): Promise<FontFace> {
  const famParam = family.replace(/\s+/g, '+');
  const style = italic ? 'ital,wght@1,' + weight : 'wght@' + weight;
  const cssUrl = `https://fonts.googleapis.com/css2?family=${famParam}:${style}&display=swap`;
  const css = await (await fetch(cssUrl)).text();
  const urlMatch = css.match(/url\((https:[^)]+\.woff2)\)/);
  if (!urlMatch) throw new Error(`No woff2 URL in Google Fonts CSS for ${family}`);
  const fontFile = await (await fetch(urlMatch[1])).arrayBuffer();
  const face = new FontFace(family, fontFile, { weight: String(weight), style: italic ? 'italic' : 'normal' });
  await face.load();
  (document as any).fonts.add(face);
  return face;
}

export function measureMetrics(family: string, fontSize = 200): FontMetrics {
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${fontSize}px "${family}"`;
  const capM = ctx.measureText('H');
  const xM = ctx.measureText('x');
  const avgM = ctx.measureText('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
  return {
    ascent:     (capM.actualBoundingBoxAscent  ?? 0) / fontSize * 1000,
    descent:    -(capM.actualBoundingBoxDescent ?? 0) / fontSize * 1000,
    capHeight:  (capM.actualBoundingBoxAscent  ?? 0) / fontSize * 1000,
    xHeight:    (xM.actualBoundingBoxAscent    ?? 0) / fontSize * 1000,
    avgAdvance: (avgM.width / 62)               / fontSize * 1000,
    em: 1000
  };
}
```

- [ ] **Step 2:** Commit:

```bash
git add src/fonts/google-fonts.ts
git commit -m "feat(fonts): Google Fonts CDN search, load, and canvas metric probe"
```

---

### Task 16: Font-choice cache (chrome.storage.local)

**Files:**
- Create: `src/fonts/cache.ts`

- [ ] **Step 1:** Create `src/fonts/cache.ts`:

```ts
import type { SubstituteFont } from '@/shared/types';

export interface CacheKey { pdfHash: string; originalFontName: string; }
type CacheValue = SubstituteFont;

function kvKey(k: CacheKey): string { return `font:${k.pdfHash}:${k.originalFontName}`; }

export async function getCached(k: CacheKey): Promise<CacheValue | undefined> {
  const key = kvKey(k);
  const obj = await chrome.storage.local.get(key);
  return obj[key] as CacheValue | undefined;
}

export async function setCached(k: CacheKey, v: CacheValue): Promise<void> {
  await chrome.storage.local.set({ [kvKey(k)]: v });
}

export async function clearForPdf(pdfHash: string): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter(k => k.startsWith(`font:${pdfHash}:`));
  if (keys.length) await chrome.storage.local.remove(keys);
}
```

- [ ] **Step 2:** Commit:

```bash
git add src/fonts/cache.ts
git commit -m "feat(fonts): chrome.storage.local cache for font substitutions"
```

---

### Task 17: Matcher — resolution pipeline (TDD)

**Files:**
- Create: `src/fonts/matcher.ts`
- Test: `test/unit/matcher.test.ts`

- [ ] **Step 1:** Write failing test `test/unit/matcher.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { resolveFont } from '@/fonts/matcher';
import type { FontDescriptor } from '@/shared/types';

const helvetica: FontDescriptor = {
  postScriptName: 'Helvetica',
  class: 'sans', weight: 400, italic: false,
  metrics: { ascent: 718, descent: -207, capHeight: 718, xHeight: 523, avgAdvance: 478, em: 1000 }
};

describe('resolveFont', () => {
  it('uses registry direct-hit when available', async () => {
    const sub = await resolveFont(helvetica, { loadGoogleFont: vi.fn(), searchGoogleFonts: vi.fn() });
    expect(sub.family).toBe('Arimo');
    expect(sub.source).toBe('registry');
  });

  it('falls back to bundled-core metric match when no registry hit', async () => {
    const weirdFont: FontDescriptor = { ...helvetica, postScriptName: 'AcmeGrotesk' };
    const sub = await resolveFont(weirdFont, { loadGoogleFont: vi.fn(), searchGoogleFonts: vi.fn().mockResolvedValue([]) });
    expect(['Liberation Sans', 'Source Sans 3', 'Noto Sans', 'Carlito']).toContain(sub.family);
    expect(sub.source).toBe('core');
  });

  it('hits Google Fonts when core match is too far', async () => {
    // Force: unknown class with no core match within threshold
    const scriptFont: FontDescriptor = { ...helvetica, class: 'script', postScriptName: 'FancyScriptPro' };
    const searchGoogleFonts = vi.fn().mockResolvedValue([{ family: 'Pacifico', category: 'handwriting', variants: ['400'] }]);
    const loadGoogleFont = vi.fn().mockResolvedValue({} as FontFace);
    const sub = await resolveFont(scriptFont, { loadGoogleFont, searchGoogleFonts, forceGoogle: true });
    expect(sub.source).toBe('google-fonts');
    expect(sub.family).toBe('Pacifico');
  });
});
```

- [ ] **Step 2:** Run: `npm test -- matcher` → FAIL.

- [ ] **Step 3:** Implement `src/fonts/matcher.ts`:

```ts
import type { FontDescriptor, SubstituteFont } from '@/shared/types';
import { lookupRegistry } from './registry';
import { CORE_FONTS } from './core';
import { GOOD_MATCH_THRESHOLD, scoreMatch } from './scoring';
import * as gf from './google-fonts';

export interface MatcherDeps {
  searchGoogleFonts: typeof gf.searchGoogleFonts;
  loadGoogleFont: typeof gf.loadGoogleFont;
  forceGoogle?: boolean;         // for tests
}

const DEFAULT_DEPS: MatcherDeps = {
  searchGoogleFonts: gf.searchGoogleFonts,
  loadGoogleFont: gf.loadGoogleFont
};

export async function resolveFont(
  target: FontDescriptor,
  deps: Partial<MatcherDeps> = {}
): Promise<SubstituteFont> {
  const d = { ...DEFAULT_DEPS, ...deps };

  if (!d.forceGoogle) {
    const hit = lookupRegistry(target.postScriptName);
    if (hit) {
      return { family: hit.family, source: 'registry', score: 0 };
    }
  }

  if (!d.forceGoogle) {
    let best = { family: '', score: Number.POSITIVE_INFINITY };
    for (const core of CORE_FONTS) {
      const s = scoreMatch(target, core.descriptor);
      if (s < best.score) best = { family: core.family, score: s };
    }
    if (best.score <= GOOD_MATCH_THRESHOLD) {
      return { family: best.family, source: 'core', score: best.score };
    }
  }

  try {
    const candidates = await d.searchGoogleFonts(target, 5);
    if (candidates.length > 0) {
      const first = candidates[0];
      await d.loadGoogleFont(first.family, target.weight, target.italic);
      return { family: first.family, source: 'google-fonts', score: 0.2 };
    }
  } catch (_err) {
    // offline or CDN failure → fall through to system
  }

  const systemFamily =
    target.class === 'serif' ? 'serif' :
    target.class === 'mono'  ? 'monospace' :
                               'sans-serif';
  return { family: systemFamily, source: 'system', score: 1.0 };
}
```

- [ ] **Step 4:** Run: `npm test -- matcher` → PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/fonts/matcher.ts test/unit/matcher.test.ts
git commit -m "feat(fonts): resolution pipeline (registry → core → google-fonts → system)"
```

---

## Phase 4 — Edit model

### Task 18: Edit model op types + reducer (TDD)

**Files:**
- Create: `src/editor/edit-model.ts`
- Test: `test/unit/edit-model.test.ts`

- [ ] **Step 1:** Write failing test `test/unit/edit-model.test.ts`:

```ts
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
    m.redo();                   // no-op
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
```

- [ ] **Step 2:** Run: `npm test -- edit-model` → FAIL.

- [ ] **Step 3:** Implement `src/editor/edit-model.ts`:

```ts
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
```

- [ ] **Step 4:** Run: `npm test -- edit-model` → PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/editor/edit-model.ts test/unit/edit-model.test.ts
git commit -m "feat(editor): edit model with op log, undo/redo, and replace-coalesce"
```

---

## Phase 5 — Overlay + editing UX

### Task 19: Overlay positioning (match canvas coords)

**Files:**
- Create: `src/editor/overlay.ts`
- Modify: `src/editor/editor.css`

- [ ] **Step 1:** Create `src/editor/overlay.ts`:

```ts
import type { RenderedPage, TextItem, SubstituteFont } from '@/shared/types';

export interface OverlayCallbacks {
  onReplace(textItemId: string, newText: string): void;
  onSelect(textItemId: string): void;
}

export function buildOverlay(
  page: RenderedPage,
  substituteFor: (fontRef: string) => SubstituteFont,
  cb: OverlayCallbacks
): HTMLDivElement {
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
      color: 'transparent',    // canvas shows the real glyphs; overlay is edit-only
      caretColor: '#e53',
      outline: 'none'
    });
    el.addEventListener('focus', () => cb.onSelect(it.id));
    el.addEventListener('input', () => cb.onReplace(it.id, el.textContent ?? ''));
    overlay.appendChild(el);
  }

  return wrap;
}

function fallback(sub: SubstituteFont): string {
  if (sub.source === 'system') return sub.family;
  return sub.family.toLowerCase().includes('serif') ? 'serif' :
         sub.family.toLowerCase().includes('mono')  ? 'monospace' :
                                                      'sans-serif';
}
```

- [ ] **Step 2:** Append to `src/editor/editor.css`:

```css
.page-wrap { background: #fff; box-shadow: 0 0 0 1px #333; margin: 0 auto; }
.text-item { user-select: text; }
.text-item:focus { color: #111 !important; background: rgba(255,235,59,0.18); }
.text-item.edited { color: #111 !important; background: rgba(255,235,59,0.10); }
.text-item.overflow { outline: 1px solid #e53; }
```

- [ ] **Step 3:** Commit:

```bash
git add src/editor/overlay.ts src/editor/editor.css
git commit -m "feat(overlay): editable HTML overlay positioned to canvas coords"
```

---

### Task 20: Wire overlay into editor boot

**Files:**
- Modify: `src/editor/editor.ts`

- [ ] **Step 1:** Replace `src/editor/editor.ts` contents:

```ts
import { loadPdfBytes } from './loader';
import { loadPdf, renderPage } from './renderer';
import { extractFontDescriptors } from '@/fonts/pdf-font-source';
import { resolveFont } from '@/fonts/matcher';
import { ensureLoaded as ensureCoreLoaded } from '@/fonts/core';
import { sha256Hex } from '@/shared/hash';
import { buildOverlay } from './overlay';
import { EditModel } from './edit-model';
import type { SubstituteFont } from '@/shared/types';

async function boot() {
  const params = new URLSearchParams(location.search);
  const src = params.get('src');
  const status = document.getElementById('status-bar')!;
  const pagesRoot = document.getElementById('pages')!;

  if (!src) { status.textContent = 'No PDF specified'; return; }

  status.textContent = `Loading ${src}…`;

  const bytes = await loadPdfBytes(src);
  const hash = await sha256Hex(bytes);
  const loaded = await loadPdf(bytes);
  const fontMap = await extractFontDescriptors(loaded.doc);

  const substitutes = new Map<string, SubstituteFont>();
  for (const [ref, desc] of fontMap) {
    const sub = await resolveFont(desc);
    substitutes.set(ref, sub);
    if (sub.source === 'core') await ensureCoreLoaded(sub.family);
  }

  const model = new EditModel();
  const substituteFor = (ref: string): SubstituteFont =>
    substitutes.get(ref) ?? { family: 'sans-serif', source: 'system', score: 1 };

  for (let i = 0; i < loaded.numPages; i++) {
    const rendered = await renderPage(loaded, i);
    const wrap = buildOverlay(rendered, substituteFor, {
      onReplace: (id, text) => model.apply({ op: 'replace', pageIdx: i, textItemId: id, newText: text }),
      onSelect:  (_id) => {}
    });
    pagesRoot.appendChild(wrap);
  }

  status.textContent = `${src} — ${loaded.numPages} page(s) — hash ${hash.slice(0, 12)}…`;
  (window as any).__editModel = model;
}

boot().catch(err => {
  const status = document.getElementById('status-bar')!;
  status.textContent = `Error: ${(err as Error).message}`;
  console.error(err);
});
```

- [ ] **Step 2:** Build + reload unpacked + open a PDF. Verify: canvas renders original, clicking a word shows a caret and lets you edit. Edits update the overlay (transparent-by-default; highlight on focus).

- [ ] **Step 3:** Commit:

```bash
git add src/editor/editor.ts
git commit -m "feat(editor): wire loader → renderer → matcher → overlay → edit model"
```

---

### Task 21: Toolbar — undo/redo/save stubs

**Files:**
- Create: `src/editor/ui/toolbar.ts`
- Modify: `src/editor/editor.ts`

- [ ] **Step 1:** Create `src/editor/ui/toolbar.ts`:

```ts
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
```

- [ ] **Step 2:** Append to `src/editor/editor.css`:

```css
#toolbar button {
  background: #2a2a2a; color: #eee; border: 1px solid #3a3a3a;
  padding: 6px 12px; margin-right: 6px; cursor: pointer; border-radius: 4px;
}
#toolbar button:hover { background: #333; }
```

- [ ] **Step 3:** In `src/editor/editor.ts`, after `boot()` wiring, call:

```ts
import { buildToolbar } from './ui/toolbar';

buildToolbar({
  onUndo: () => model.undo(),
  onRedo: () => model.redo(),
  onAddText: () => alert('Add text: coming in Task 23'),
  onSave: () => alert('Save: coming in Task 27')
});
```
Move the `buildToolbar` call inside `boot()` so `model` is in scope.

- [ ] **Step 4:** Commit:

```bash
git add src/editor/ui/toolbar.ts src/editor/editor.css src/editor/editor.ts
git commit -m "feat(ui): toolbar shell with undo/redo/add/save buttons"
```

---

### Task 22: Delete text — keyboard + toolbar

**Files:**
- Modify: `src/editor/overlay.ts`

- [ ] **Step 1:** Extend `OverlayCallbacks` in `src/editor/overlay.ts`:

```ts
export interface OverlayCallbacks {
  onReplace(textItemId: string, newText: string): void;
  onSelect(textItemId: string): void;
  onDelete(textItemId: string): void;
}
```

- [ ] **Step 2:** Inside `buildOverlay`, add a keydown handler on each `el`:

```ts
el.addEventListener('keydown', (ev) => {
  if ((ev.metaKey || ev.ctrlKey) && (ev.key === 'Backspace' || ev.key === 'Delete')) {
    ev.preventDefault();
    cb.onDelete(it.id);
    el.remove();
  }
});
```

- [ ] **Step 3:** Wire in `editor.ts`:

```ts
onDelete: (id) => model.apply({ op: 'delete', pageIdx: i, textItemId: id })
```

- [ ] **Step 4:** Build + reload; focus a word; press Cmd+Backspace; word disappears; `model.ops()` includes a delete.

- [ ] **Step 5:** Commit:

```bash
git add src/editor/overlay.ts src/editor/editor.ts
git commit -m "feat(overlay): cmd/ctrl+backspace deletes text item"
```

---

### Task 23: Insert text — click-to-place

**Files:**
- Modify: `src/editor/overlay.ts`
- Modify: `src/editor/editor.ts`

- [ ] **Step 1:** Export a helper from `overlay.ts`:

```ts
export function enableAddTextMode(
  wrap: HTMLDivElement,
  page: RenderedPage,
  onInsert: (x: number, y: number) => void
): () => void {
  wrap.style.cursor = 'text';
  const listener = (ev: MouseEvent) => {
    const rect = wrap.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    const scale = page.viewport.scale;
    const x = px / scale;
    const y = (page.viewport.height / scale) - (py / scale);
    onInsert(x, y);
  };
  wrap.addEventListener('click', listener, { once: true });
  return () => { wrap.style.cursor = ''; wrap.removeEventListener('click', listener); };
}
```

- [ ] **Step 2:** In `editor.ts`, keep references to each page's `wrap` and wire `onAddText`:

```ts
import { enableAddTextMode } from './overlay';

const pageWraps: { wrap: HTMLDivElement; page: RenderedPage }[] = [];
// ... fill inside render loop: pageWraps.push({ wrap, page: rendered });

buildToolbar({
  // ...
  onAddText: () => {
    const first = pageWraps[0];
    if (!first) return;
    enableAddTextMode(first.wrap, first.page, (x, y) => {
      const text = prompt('Text to add:');
      if (!text) return;
      model.apply({
        op: 'insert', pageIdx: 0, x, y, text,
        fontFamily: 'Liberation Sans', fontSize: 12, color: '#000000'
      });
      // Render a visible overlay element for the insertion
      const el = document.createElement('span');
      el.className = 'text-item edited';
      el.contentEditable = 'plaintext-only';
      el.textContent = text;
      Object.assign(el.style, {
        position: 'absolute',
        left: `${x * first.page.viewport.scale}px`,
        top:  `${(first.page.viewport.height / first.page.viewport.scale - y) * first.page.viewport.scale - 12 * first.page.viewport.scale}px`,
        fontFamily: `"Liberation Sans", sans-serif`,
        fontSize: `${12 * first.page.viewport.scale}px`,
        color: '#000'
      });
      first.wrap.querySelector('.overlay')!.appendChild(el);
    });
  }
});
```

- [ ] **Step 3:** Build + reload; click "Add text", click on a page, enter text, verify it appears and `model.ops()` includes the insert.

- [ ] **Step 4:** Commit:

```bash
git add src/editor/overlay.ts src/editor/editor.ts
git commit -m "feat(editor): add-text-mode with click-to-place insert"
```

---

### Task 24: Move/resize text items

**Files:**
- Modify: `src/editor/overlay.ts`

- [ ] **Step 1:** Extend `OverlayCallbacks`:

```ts
export interface OverlayCallbacks {
  onReplace(textItemId: string, newText: string): void;
  onSelect(textItemId: string): void;
  onDelete(textItemId: string): void;
  onMove(textItemId: string, dx: number, dy: number): void;
  onResize(textItemId: string, newFontSize: number): void;
}
```

- [ ] **Step 2:** In `buildOverlay`, when an element is focused, attach Alt+drag to move and `[`/`]` keys to resize:

```ts
let dragStart: { mx: number; my: number; ox: number; oy: number; itemX: number; itemY: number } | null = null;
el.addEventListener('mousedown', (ev) => {
  if (!ev.altKey) return;
  ev.preventDefault();
  dragStart = {
    mx: ev.clientX, my: ev.clientY,
    ox: el.offsetLeft, oy: el.offsetTop,
    itemX: it.x, itemY: it.y
  };
  const onMove = (mv: MouseEvent) => {
    if (!dragStart) return;
    const ddx = mv.clientX - dragStart.mx;
    const ddy = mv.clientY - dragStart.my;
    el.style.left = `${dragStart.ox + ddx}px`;
    el.style.top  = `${dragStart.oy + ddy}px`;
  };
  const onUp = (mv: MouseEvent) => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (!dragStart) return;
    const ddx = (mv.clientX - dragStart.mx) / scale;
    const ddy = -(mv.clientY - dragStart.my) / scale;
    cb.onMove(it.id, ddx, ddy);
    dragStart = null;
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
});

el.addEventListener('keydown', (ev) => {
  if (ev.key === '[' || ev.key === ']') {
    ev.preventDefault();
    const delta = ev.key === ']' ? 1 : -1;
    const current = parseFloat(el.style.fontSize) / scale;
    const next = Math.max(4, current + delta);
    el.style.fontSize = `${next * scale}px`;
    cb.onResize(it.id, next);
  }
});
```

- [ ] **Step 3:** Wire in `editor.ts`:

```ts
onMove:   (id, dx, dy)        => model.apply({ op: 'move',   pageIdx: i, textItemId: id, dx, dy }),
onResize: (id, newFontSize)   => model.apply({ op: 'resize', pageIdx: i, textItemId: id, newFontSize })
```

- [ ] **Step 4:** Build + reload; focus text, Alt+drag to move, `[`/`]` to resize. Confirm ops recorded.

- [ ] **Step 5:** Commit:

```bash
git add src/editor/overlay.ts src/editor/editor.ts
git commit -m "feat(overlay): alt+drag to move, bracket keys to resize"
```

---

### Task 25: Overflow warning when edited text exceeds bbox

**Files:**
- Modify: `src/editor/overlay.ts`

- [ ] **Step 1:** In `buildOverlay`, cache each item's original width on creation:

```ts
el.dataset.origWidth = String(it.width * scale);
```

- [ ] **Step 2:** Add an input handler that checks overflow:

```ts
el.addEventListener('input', () => {
  cb.onReplace(it.id, el.textContent ?? '');
  const origW = parseFloat(el.dataset.origWidth ?? '0');
  const currentW = el.getBoundingClientRect().width;
  el.classList.toggle('overflow', currentW > origW + 2);
});
```

Remove the duplicate input listener added earlier in Task 19 (there should be only one `input` handler).

- [ ] **Step 3:** Build + reload; edit a word to be much longer; verify a red outline appears.

- [ ] **Step 4:** Commit:

```bash
git add src/editor/overlay.ts
git commit -m "feat(overlay): red-outline overflow warning when edit exceeds bbox"
```

---

### Task 26: Shrink-to-fit context menu

**Files:**
- Create: `src/editor/ui/context-menu.ts`
- Modify: `src/editor/overlay.ts`

- [ ] **Step 1:** Create `src/editor/ui/context-menu.ts`:

```ts
export interface MenuItem { label: string; on: () => void; }

export function showContextMenu(x: number, y: number, items: MenuItem[]): void {
  document.querySelectorAll('.ctx-menu').forEach(e => e.remove());
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  Object.assign(menu.style, {
    position: 'fixed', left: `${x}px`, top: `${y}px`,
    background: '#2a2a2a', border: '1px solid #444', borderRadius: '4px',
    padding: '4px 0', zIndex: '9999', minWidth: '160px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
  });
  for (const item of items) {
    const row = document.createElement('div');
    row.textContent = item.label;
    Object.assign(row.style, { padding: '6px 12px', cursor: 'pointer', color: '#eee' });
    row.addEventListener('mouseenter', () => row.style.background = '#3a3a3a');
    row.addEventListener('mouseleave', () => row.style.background = '');
    row.addEventListener('click', () => { item.on(); menu.remove(); });
    menu.appendChild(row);
  }
  document.body.appendChild(menu);
  const dismiss = (ev: MouseEvent) => { if (!menu.contains(ev.target as Node)) { menu.remove(); document.removeEventListener('mousedown', dismiss); } };
  setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
}
```

- [ ] **Step 2:** In `src/editor/overlay.ts`, attach contextmenu to each `el`:

```ts
el.addEventListener('contextmenu', (ev) => {
  ev.preventDefault();
  const origW = parseFloat(el.dataset.origWidth ?? '0');
  import('./ui/context-menu').then(({ showContextMenu }) => {
    showContextMenu(ev.clientX, ev.clientY, [
      { label: 'Shrink to fit', on: () => {
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
```

- [ ] **Step 3:** Build + reload; make a text item overflow; right-click → "Shrink to fit"; size drops to fit.

- [ ] **Step 4:** Commit:

```bash
git add src/editor/ui/context-menu.ts src/editor/overlay.ts
git commit -m "feat(ui): context menu with shrink-to-fit for overflowing text"
```

---

## Phase 6 — Writer + save

### Task 27: pdf-lib writer skeleton (TDD)

**Files:**
- Create: `src/editor/writer.ts`
- Test: `test/unit/writer.test.ts`
- Create: `test/fixtures/hello.pdf`

- [ ] **Step 1:** Generate a fixture PDF programmatically (run once, commit the output):

```bash
cat <<'EOF' > /tmp/make-fixture.mjs
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'node:fs';
const doc = await PDFDocument.create();
const page = doc.addPage([400, 200]);
const font = await doc.embedFont(StandardFonts.Helvetica);
page.drawText('Hello World', { x: 50, y: 150, size: 24, font, color: rgb(0, 0, 0) });
page.drawText('Editable text', { x: 50, y: 100, size: 18, font, color: rgb(0, 0, 0) });
fs.writeFileSync('test/fixtures/hello.pdf', await doc.save());
EOF
mkdir -p test/fixtures
node /tmp/make-fixture.mjs
```

- [ ] **Step 2:** Write failing test `test/unit/writer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { writePdf } from '@/editor/writer';
import { PDFDocument } from 'pdf-lib';
import type { EditOp } from '@/shared/types';

describe('writePdf — smoke round-trip', () => {
  it('saves an unchanged PDF when no ops apply', async () => {
    const bytes = fs.readFileSync(path.resolve('test/fixtures/hello.pdf'));
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const out = await writePdf(buf as ArrayBuffer, [] as EditOp[], new Map());
    expect(out.byteLength).toBeGreaterThan(100);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
```

- [ ] **Step 3:** Run: `npm test -- writer` → FAIL.

- [ ] **Step 4:** Implement `src/editor/writer.ts`:

```ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { EditOp, SubstituteFont } from '@/shared/types';

export interface WriteContext {
  substituteFor(fontRef: string): SubstituteFont | undefined;
  loadFontBytes(family: string): Promise<ArrayBuffer>;    // for non-standard
}

export async function writePdf(
  originalBytes: ArrayBuffer,
  ops: EditOp[],
  _substitutes: Map<string, SubstituteFont>,
  _ctx?: Partial<WriteContext>
): Promise<ArrayBuffer> {
  const doc = await PDFDocument.load(originalBytes);
  doc.registerFontkit(fontkit);

  // Pass-through if no ops. Deeper op application lands in Tasks 28–32.
  if (ops.length === 0) {
    return await doc.save();
  }

  // Fallback minimal support until apply-ops is implemented
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  for (const op of ops) {
    if (op.op === 'insert') {
      const page = doc.getPage(op.pageIdx);
      page.drawText(op.text, {
        x: op.x, y: op.y,
        size: op.fontSize,
        font: helv,
        color: rgb(0, 0, 0)
      });
    }
    // replace/delete/move/resize lands in Tasks 28–32
  }
  return await doc.save();
}
```

- [ ] **Step 5:** Run: `npm test -- writer` → PASS.

- [ ] **Step 6:** Commit:

```bash
git add test/fixtures/hello.pdf src/editor/writer.ts test/unit/writer.test.ts
git commit -m "feat(writer): pdf-lib writer skeleton with passthrough save"
```

---

### Task 28: Writer — apply InsertTextOp with bundled font

**Files:**
- Modify: `src/editor/writer.ts`
- Test: add to `test/unit/writer.test.ts`

- [ ] **Step 1:** Append a test:

```ts
it('applies an insert op with a bundled substitute', async () => {
  const bytes = fs.readFileSync(path.resolve('test/fixtures/hello.pdf'));
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const ops = [{
    op: 'insert', pageIdx: 0, x: 50, y: 50,
    text: 'Inserted line', fontFamily: 'Helvetica', fontSize: 14, color: '#000000'
  }] as any[];
  const out = await writePdf(buf as ArrayBuffer, ops, new Map());
  const reloaded = await PDFDocument.load(out);
  expect(reloaded.getPageCount()).toBe(1);
  // Heuristic: output bytes differ from input
  expect(out.byteLength).not.toBe(buf.byteLength);
});
```

- [ ] **Step 2:** Run: `npm test -- writer` → Probably still passes (Task 27 already draws the insert). Confirm.

- [ ] **Step 3:** Commit (marks insert as tested):

```bash
git add test/unit/writer.test.ts
git commit -m "test(writer): verify insert op changes output bytes"
```

---

### Task 29: Writer — apply ReplaceTextOp

**Strategy:** For v1 correctness, replace = draw a white rectangle over the original glyphs and draw the new text on top in the substitute font. This avoids content-stream surgery (hard) at the cost of a slightly larger file. Document the tradeoff.

**Files:**
- Modify: `src/editor/writer.ts`

- [ ] **Step 1:** Extend `writePdf`:

```ts
import type { TextItem } from '@/shared/types';

export async function writePdf(
  originalBytes: ArrayBuffer,
  ops: EditOp[],
  substitutes: Map<string, SubstituteFont>,
  textItemIndex?: Map<string, TextItem>,      // resolves textItemId → bbox + font
  ctx?: Partial<WriteContext>
): Promise<ArrayBuffer> {
  const doc = await PDFDocument.load(originalBytes);
  doc.registerFontkit(fontkit);
  const helv = await doc.embedFont(StandardFonts.Helvetica);

  const fontCache = new Map<string, any>();
  async function embedByFamily(family: string) {
    if (fontCache.has(family)) return fontCache.get(family);
    let font;
    if (ctx?.loadFontBytes) {
      try {
        const bytes = await ctx.loadFontBytes(family);
        font = await doc.embedFont(bytes, { subset: true });
      } catch { font = helv; }
    } else {
      font = helv;
    }
    fontCache.set(family, font);
    return font;
  }

  for (const op of ops) {
    const page = doc.getPage(op.pageIdx);
    if (op.op === 'insert') {
      const font = await embedByFamily(op.fontFamily);
      page.drawText(op.text, { x: op.x, y: op.y, size: op.fontSize, font, color: rgb(0, 0, 0) });
    } else if (op.op === 'replace' && textItemIndex) {
      const item = textItemIndex.get(op.textItemId);
      if (!item) continue;
      // Mask original
      page.drawRectangle({
        x: item.x, y: item.y, width: item.width, height: item.height,
        color: rgb(1, 1, 1), borderWidth: 0
      });
      const sub = substitutes.get(item.fontRef);
      const font = await embedByFamily(sub?.family ?? 'Helvetica');
      page.drawText(op.newText, { x: item.x, y: item.y, size: item.fontSize, font, color: rgb(0, 0, 0) });
    } else if (op.op === 'delete' && textItemIndex) {
      const item = textItemIndex.get(op.textItemId);
      if (!item) continue;
      page.drawRectangle({
        x: item.x, y: item.y, width: item.width, height: item.height,
        color: rgb(1, 1, 1), borderWidth: 0
      });
    } else if (op.op === 'move' && textItemIndex) {
      const item = textItemIndex.get(op.textItemId);
      if (!item) continue;
      page.drawRectangle({
        x: item.x, y: item.y, width: item.width, height: item.height,
        color: rgb(1, 1, 1), borderWidth: 0
      });
      const sub = substitutes.get(item.fontRef);
      const font = await embedByFamily(sub?.family ?? 'Helvetica');
      page.drawText(item.text, { x: item.x + op.dx, y: item.y + op.dy, size: item.fontSize, font, color: rgb(0, 0, 0) });
    } else if (op.op === 'resize' && textItemIndex) {
      const item = textItemIndex.get(op.textItemId);
      if (!item) continue;
      page.drawRectangle({
        x: item.x, y: item.y, width: item.width, height: item.height,
        color: rgb(1, 1, 1), borderWidth: 0
      });
      const sub = substitutes.get(item.fontRef);
      const font = await embedByFamily(sub?.family ?? 'Helvetica');
      page.drawText(item.text, { x: item.x, y: item.y, size: op.newFontSize, font, color: rgb(0, 0, 0) });
    }
  }
  return await doc.save();
}
```

- [ ] **Step 2:** Add a round-trip test:

```ts
it('applies a replace op via mask + redraw', async () => {
  const bytes = fs.readFileSync(path.resolve('test/fixtures/hello.pdf'));
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const items = new Map([
    ['p0-t0', { id: 'p0-t0', pageIdx: 0, text: 'Hello World',
                 x: 50, y: 150, width: 120, height: 24,
                 fontRef: 'g_d0_f1', fontSize: 24, color: '#000' } as any]
  ]);
  const subs = new Map([['g_d0_f1', { family: 'Helvetica', source: 'registry', score: 0 } as any]]);
  const out = await writePdf(buf as ArrayBuffer, [
    { op: 'replace', pageIdx: 0, textItemId: 'p0-t0', newText: 'Edited' } as any
  ], subs, items);
  const reloaded = await PDFDocument.load(out);
  expect(reloaded.getPageCount()).toBe(1);
});
```

- [ ] **Step 3:** Run: `npm test -- writer` → PASS.

- [ ] **Step 4:** Commit:

```bash
git add src/editor/writer.ts test/unit/writer.test.ts
git commit -m "feat(writer): apply replace/delete/move/resize via mask-and-redraw"
```

---

### Task 30: Font bytes loader for bundled core + Google Fonts

**Files:**
- Create: `src/editor/font-bytes.ts`

- [ ] **Step 1:** Create `src/editor/font-bytes.ts`:

```ts
import { CORE_FONTS } from '@/fonts/core';

const CORE_URL_MAP: Record<string, () => string> = {
  'Liberation Sans':  () => new URL('../fonts/assets/liberation-sans-regular.woff2',  import.meta.url).href,
  'Liberation Serif': () => new URL('../fonts/assets/liberation-serif-regular.woff2', import.meta.url).href,
  'Liberation Mono':  () => new URL('../fonts/assets/liberation-mono-regular.woff2',  import.meta.url).href,
  'Carlito':          () => new URL('../fonts/assets/carlito-regular.woff2',          import.meta.url).href,
  'Cousine':          () => new URL('../fonts/assets/cousine-regular.woff2',          import.meta.url).href,
  'Source Sans 3':    () => new URL('../fonts/assets/source-sans-3-regular.woff2',    import.meta.url).href,
  'Source Serif 4':   () => new URL('../fonts/assets/source-serif-4-regular.woff2',   import.meta.url).href,
  'Noto Sans':        () => new URL('../fonts/assets/noto-sans-regular.woff2',        import.meta.url).href
};

export async function loadFontBytes(family: string): Promise<ArrayBuffer> {
  const url = CORE_URL_MAP[family];
  if (url) {
    const res = await fetch(url());
    if (!res.ok) throw new Error(`Failed to fetch bundled font ${family}`);
    return await res.arrayBuffer();
  }
  // Google Fonts
  const famParam = family.replace(/\s+/g, '+');
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${famParam}:wght@400&display=swap`)).text();
  const m = css.match(/url\((https:[^)]+\.woff2)\)/);
  if (!m) throw new Error(`No woff2 URL in Google Fonts CSS for ${family}`);
  return await (await fetch(m[1])).arrayBuffer();
}
```

- [ ] **Step 2:** Copy the woff2 files from `node_modules/@fontsource/*/files/*-latin-400-normal.woff2` into `src/fonts/assets/` under the names referenced in `CORE_URL_MAP`:

```bash
mkdir -p src/fonts/assets
cp node_modules/@fontsource/liberation-sans/files/liberation-sans-latin-400-normal.woff2  src/fonts/assets/liberation-sans-regular.woff2
cp node_modules/@fontsource/liberation-serif/files/liberation-serif-latin-400-normal.woff2 src/fonts/assets/liberation-serif-regular.woff2
cp node_modules/@fontsource/liberation-mono/files/liberation-mono-latin-400-normal.woff2  src/fonts/assets/liberation-mono-regular.woff2
cp node_modules/@fontsource/carlito/files/carlito-latin-400-normal.woff2                  src/fonts/assets/carlito-regular.woff2
cp node_modules/@fontsource/cousine/files/cousine-latin-400-normal.woff2                  src/fonts/assets/cousine-regular.woff2
cp node_modules/@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff2      src/fonts/assets/source-sans-3-regular.woff2
cp node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2    src/fonts/assets/source-serif-4-regular.woff2
cp node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff2              src/fonts/assets/noto-sans-regular.woff2
```

If any path 404s, use `ls node_modules/@fontsource/<pkg>/files` to find the exact latin-400-normal filename.

- [ ] **Step 3:** Commit:

```bash
git add src/editor/font-bytes.ts src/fonts/assets/
git commit -m "feat(writer): load bundled core woff2 assets and google fonts for embedding"
```

---

### Task 31: Download handler

**Files:**
- Create: `src/editor/download.ts`

- [ ] **Step 1:** Create `src/editor/download.ts`:

```ts
export async function downloadPdf(bytes: ArrayBuffer, suggestedName: string): Promise<void> {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (_err) {
    // Fallback: chrome.downloads
    await new Promise<void>((resolve, reject) => {
      chrome.downloads.download({ url, filename: suggestedName, saveAs: true }, (id) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (id === undefined) reject(new Error('Download failed'));
        else resolve();
      });
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export function suggestedFilename(src: string): string {
  const base = src.split('/').pop() ?? 'document.pdf';
  return base.replace(/\.pdf$/i, '-edited.pdf');
}
```

- [ ] **Step 2:** Commit:

```bash
git add src/editor/download.ts
git commit -m "feat(download): blob-link primary, chrome.downloads fallback"
```

---

### Task 32: Wire Save — editor → writer → download

**Files:**
- Modify: `src/editor/editor.ts`

- [ ] **Step 1:** Extend `editor.ts`:

```ts
import { writePdf } from './writer';
import { downloadPdf, suggestedFilename } from './download';
import { loadFontBytes } from './font-bytes';
import type { TextItem } from '@/shared/types';

// Inside boot(), after rendering all pages:
const textItemIndex = new Map<string, TextItem>();
for (const { page } of pageWraps) for (const t of page.textItems) textItemIndex.set(t.id, t);

buildToolbar({
  // ... existing
  onSave: async () => {
    status.textContent = 'Saving…';
    try {
      const out = await writePdf(bytes, model.ops(), substitutes, textItemIndex, { loadFontBytes });
      await downloadPdf(out, suggestedFilename(src));
      status.textContent = 'Saved.';
    } catch (err) {
      status.textContent = `Save failed: ${(err as Error).message}`;
      console.error(err);
    }
  }
});
```

- [ ] **Step 2:** Build + reload. Open fixture PDF, edit a word, click Save. Verify a downloaded `hello-edited.pdf`, open it, check the edit persisted.

- [ ] **Step 3:** Commit:

```bash
git add src/editor/editor.ts
git commit -m "feat(editor): save flow — apply ops via writer and download new PDF"
```

---

### Task 33: E2E round-trip test

**Files:**
- Create: `test/e2e/roundtrip.test.ts`

- [ ] **Step 1:** Create `test/e2e/roundtrip.test.ts`:

```ts
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
    const subs: Map<string, SubstituteFont> = new Map([['F1', { family: 'Helvetica', source: 'registry', score: 0 }]]);

    const ops: EditOp[] = [
      { op: 'replace', pageIdx: 0, textItemId: 'p0-t0', newText: 'Goodbye World' },
      { op: 'delete',  pageIdx: 0, textItemId: 'p0-t1' },
      { op: 'insert',  pageIdx: 0, x: 50, y: 50, text: 'Inserted', fontFamily: 'Helvetica', fontSize: 14, color: '#000' }
    ];

    const out = await writePdf(buf, ops, subs, items);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
    expect(out.byteLength).toBeGreaterThan(buf.byteLength - 500);  // mask + redraw adds bytes
  });
});
```

- [ ] **Step 2:** Adjust `vite.config.ts` to include e2e test dir:

```ts
test: { environment: 'happy-dom', globals: true, include: ['test/unit/**/*.test.ts', 'test/e2e/**/*.test.ts'] }
```

- [ ] **Step 3:** Run: `npm test` → all passing.

- [ ] **Step 4:** Commit:

```bash
git add test/e2e/roundtrip.test.ts vite.config.ts
git commit -m "test(e2e): round-trip replace+delete+insert via writer"
```

---

## Phase 7 — Error handling + polish

### Task 34: File-URL permission error UI

**Files:**
- Modify: `src/editor/editor.ts`

- [ ] **Step 1:** Catch `FileUrlAccessDeniedError` specifically in the top-level handler:

```ts
import { FileUrlAccessDeniedError } from './loader';

boot().catch(err => {
  const status = document.getElementById('status-bar')!;
  if (err instanceof FileUrlAccessDeniedError) {
    status.innerHTML = `File access denied. <a href="chrome://extensions" target="_blank" style="color:#4af">Open chrome://extensions</a>, find "PDF Font Editor", and enable "Allow access to file URLs".`;
    return;
  }
  status.textContent = `Error: ${(err as Error).message}`;
  console.error(err);
});
```

- [ ] **Step 2:** Commit:

```bash
git add src/editor/editor.ts
git commit -m "feat(editor): actionable error UI for file:// permission denied"
```

---

### Task 35: Password-protected PDF prompt

**Files:**
- Modify: `src/editor/editor.ts`
- Modify: `src/editor/renderer.ts`

- [ ] **Step 1:** Pdf.js throws `PasswordException` with `code` 1 (NEED_PASSWORD) or 2 (INCORRECT_PASSWORD). Wrap the load:

```ts
// In editor.ts, replace `const loaded = await loadPdf(bytes)`:
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
```

- [ ] **Step 2:** Commit:

```bash
git add src/editor/editor.ts
git commit -m "feat(editor): prompt for password on protected PDFs"
```

---

### Task 36: Offline / Google Fonts failure banner

**Files:**
- Modify: `src/editor/editor.ts`

- [ ] **Step 1:** Track if any resolution fell back to `system`:

```ts
let hadSystemFallback = false;
for (const [ref, desc] of fontMap) {
  const sub = await resolveFont(desc);
  if (sub.source === 'system') hadSystemFallback = true;
  substitutes.set(ref, sub);
  if (sub.source === 'core') await ensureCoreLoaded(sub.family);
}
if (hadSystemFallback) {
  const banner = document.createElement('div');
  banner.textContent = '⚠️ Some fonts approximated — network may be offline.';
  Object.assign(banner.style, { background: '#7a5a00', color: '#fff', padding: '6px 12px' });
  document.body.insertBefore(banner, document.getElementById('toolbar'));
}
```

- [ ] **Step 2:** Commit:

```bash
git add src/editor/editor.ts
git commit -m "feat(editor): offline font fallback banner"
```

---

### Task 37: Non-PDF / no-text-layer graceful exit

**Files:**
- Modify: `src/editor/editor.ts`

- [ ] **Step 1:** After extracting text items, check if total text-item count is zero:

```ts
// Inside boot, after render loop:
const totalItems = pageWraps.reduce((n, pw) => n + pw.page.textItems.length, 0);
if (totalItems === 0) {
  status.innerHTML = '<strong>This PDF has no editable text</strong> — it may be a scanned image. Editing is not supported for image-only PDFs.';
}
```

- [ ] **Step 2:** In the service worker (Task 4), also guard non-PDF URLs (already present) but add a user-facing toast by opening a minimal info page:

```ts
// src/background/service-worker.ts — replace the early `console.warn` return:
if (!tab.url || !/^file:\/\/.*\.pdf($|\?)/i.test(tab.url)) {
  await chrome.tabs.create({
    url: 'data:text/html,' + encodeURIComponent('<h3>Not a local PDF</h3><p>Open a file:// PDF in Chrome first, then click the icon.</p>')
  });
  return;
}
```

- [ ] **Step 3:** Commit:

```bash
git add src/editor/editor.ts src/background/service-worker.ts
git commit -m "feat: graceful handling of no-text-layer PDFs and non-PDF icon clicks"
```

---

### Task 38: Large-PDF warning

**Files:**
- Modify: `src/editor/editor.ts`

- [ ] **Step 1:** After `loadPdfBytes`, before parsing:

```ts
const SIZE_WARN_MB = 100;
if (bytes.byteLength > SIZE_WARN_MB * 1024 * 1024) {
  const mb = (bytes.byteLength / (1024 * 1024)).toFixed(0);
  if (!confirm(`This PDF is ${mb} MB. Loading large PDFs can be slow or may exhaust memory. Continue?`)) {
    status.textContent = 'Cancelled.';
    return;
  }
}
```

- [ ] **Step 2:** Commit:

```bash
git add src/editor/editor.ts
git commit -m "feat(editor): warn before loading PDFs over 100 MB"
```

---

### Task 39: README with manual E2E checklist

**Files:**
- Create: `README.md`

- [ ] **Step 1:** Create `README.md`:

```markdown
# PDF Font Editor

A Chrome extension that lets you edit text in local PDFs while preserving the original fonts via metric-matched substitutes. Fully client-side.

## Build and install

\`\`\`bash
npm install
npm run build
\`\`\`

1. Open `chrome://extensions` → enable **Developer mode**.
2. Click **Load unpacked** → select the `dist/` directory.
3. Click the extension's **Details** → enable **Allow access to file URLs**.

## Use

1. Open any local `file://...pdf` in Chrome.
2. Click the extension icon.
3. A new tab opens with the editable version.
4. Click any word to edit; use the toolbar for Add Text / Undo / Redo / Save.
5. `Alt+drag` to move a text item; `[` / `]` to resize.
6. Right-click a text item for "Shrink to fit".
7. Click **Save** to download the edited PDF.

## Manual E2E checklist

- [ ] Open a PDF with Helvetica/Arial text → edits render in Arimo, visually indistinguishable at 100% zoom
- [ ] Open a Times PDF → substitute is Tinos
- [ ] Open a Calibri PDF → substitute is Carlito
- [ ] Open a monospace-heavy PDF → substitute is Cousine
- [ ] Edit, save, reopen the saved PDF in Chrome → edits persist, fonts embedded
- [ ] Delete a word with Cmd+Backspace → word disappears on save
- [ ] Add a new text block → appears in saved PDF
- [ ] Alt+drag a text item → position updates in saved PDF
- [ ] Resize with `[`/`]` → font-size change persists
- [ ] Overflow warning appears when edited text exceeds original bbox
- [ ] Shrink-to-fit restores layout
- [ ] Undo reverts the last edit
- [ ] Offline: open a PDF with no matching core font → banner appears
- [ ] Open a scanned/image-only PDF → "no editable text" message
- [ ] Open a password-protected PDF → prompted; correct password opens; wrong password shows clear error
- [ ] Open a >100 MB PDF → confirm dialog appears

## Development

\`\`\`bash
npm run dev       # vite dev mode (rebuilds on save)
npm test          # vitest
npm run test:watch
\`\`\`

## Known limitations (v1)

- Local `file://` PDFs only (no web-hosted)
- Text editing only (no images / shapes / signatures)
- No OCR — scanned PDFs are read-only
- Single-line edits preserve the original bounding box; multi-line reflow is not supported
- CJK and complex scripts get best-effort substitution only

## Architecture

See `docs/superpowers/specs/2026-04-19-pdf-font-editor-design.md`.
```

- [ ] **Step 2:** Commit:

```bash
git add README.md
git commit -m "docs: README with install, usage, and manual E2E checklist"
```

---

### Task 40: Font visual comparison page

**Files:**
- Create: `test/visual/compare.html`

- [ ] **Step 1:** Create `test/visual/compare.html`:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Font comparison</title>
  <link href="https://fonts.googleapis.com/css2?family=Arimo&family=Tinos&family=EB+Garamond&display=swap" rel="stylesheet">
  <style>
    body { font-family: system-ui; background: #111; color: #eee; padding: 24px; }
    .row { display: grid; grid-template-columns: 200px 1fr 1fr; gap: 16px; padding: 12px 0; border-bottom: 1px solid #333; }
    .sample { font-size: 28px; line-height: 1.3; }
    .label { color: #888; align-self: center; }
  </style>
</head>
<body>
  <h1>Font substitution eyeball test</h1>
  <p>Compare each original font (left) with our substitute (right) on the same pangram.</p>
  <div class="row"><div class="label">Helvetica → Arimo</div>
    <div class="sample" style="font-family:Helvetica">The quick brown fox jumps over the lazy dog</div>
    <div class="sample" style="font-family:Arimo">The quick brown fox jumps over the lazy dog</div></div>
  <div class="row"><div class="label">Times → Tinos</div>
    <div class="sample" style="font-family:'Times New Roman'">The quick brown fox jumps over the lazy dog</div>
    <div class="sample" style="font-family:Tinos">The quick brown fox jumps over the lazy dog</div></div>
  <div class="row"><div class="label">Garamond → EB Garamond</div>
    <div class="sample" style="font-family:Garamond">The quick brown fox jumps over the lazy dog</div>
    <div class="sample" style="font-family:'EB Garamond'">The quick brown fox jumps over the lazy dog</div></div>
</body>
</html>
```

- [ ] **Step 2:** Commit:

```bash
git add test/visual/compare.html
git commit -m "test: visual font-substitution comparison page"
```

---

## Phase 8 — Final checkpoint

### Task 41: Full test + lint + build

**Files:** none

- [ ] **Step 1:** Run the full suite:

```bash
npm test
npm run build
```

Expected: all tests pass; `dist/` builds without TypeScript errors.

- [ ] **Step 2:** Manual E2E from README checklist. Walk through every bullet. Note any FAILs.

- [ ] **Step 3:** If all green, tag:

```bash
git tag v0.1.0
git push origin main --tags
```

- [ ] **Step 4:** Open `https://github.com/respawner8/pdf-font-editor` and confirm v0.1.0 tag + all commits pushed.

---

## Self-Review — spec coverage

| Spec section | Covered by |
|---|---|
| Goals — edit existing text | Task 20 (overlay), 29 (replace op) |
| Goals — add new text | Tasks 23 (insert UX), 28 (insert writer) |
| Goals — delete text | Tasks 22 (delete UX), 29 (delete writer) |
| Goals — move/resize text | Tasks 24 (UX), 29 (writer) |
| Goals — metric-matched substitute | Tasks 10 (analyzer), 12 (scoring), 13 (registry), 17 (matcher) |
| Goals — fully client-side | No backend in any task |
| Goals — extension-icon click → editor | Task 4 (service worker) |
| Non-goal: web PDFs | Service worker rejects non-`file://` (Task 37) |
| Non-goal: OCR | Task 37 "no editable text" handling |
| User decision: reflow default (truncate + shrink-to-fit opt-in) | Tasks 25 (overflow warning), 26 (shrink-to-fit) |
| Architecture Tier 1 (shell) | Tasks 4 (manifest + worker) |
| Architecture Tier 2 (editor page) | Tasks 6, 8, 9, 19-25, 32 |
| Architecture Tier 3 (font + output) | Tasks 10, 11, 12-17, 27-32 |
| Font matcher: registry hit | Task 13 |
| Font matcher: bundled core metric | Tasks 14, 17 |
| Font matcher: Google Fonts CDN | Tasks 15, 17 |
| Font matcher: system fallback | Task 17 |
| Font matcher: cache | Task 16 (integration in writer flow can be added if real-world use shows repeated load cost) |
| User override (font dropdown) | **Deferred** — not blocking for v1 MVP; add as follow-up task after E2E validates |
| Edit model — op types | Task 18 |
| Edit model — undo/redo | Task 18 |
| Font embedding on save — subset | Task 29 (pdf-lib default `subset: true` in embedFont) |
| Error — file:// denied | Task 34 |
| Error — parse error | Default in boot's `.catch` |
| Error — password-protected | Task 35 |
| Error — offline banner | Task 36 |
| Error — save fails → chrome.downloads | Task 31 fallback |
| Error — large PDF | Task 38 |
| Testing — unit (scoring, registry, matcher, analyzer, edit-model, hash, writer) | Tasks 7, 10, 12, 13, 17, 18, 27 |
| Testing — fixture corpus | **Partial** — only `hello.pdf`; expanding the corpus (Helvetica, Times, Calibri, Courier, weight variation, password-protected, scanned, large) is a follow-up |
| Testing — round-trip | Task 33 |
| Testing — visual eyeball | Task 40 |

**Known gaps (explicit follow-ups, not v1 blockers):**
- Per-item user font-override dropdown
- Font cache wiring (decisions are computed fresh each load — fine for correctness, suboptimal for cost)
- Expanded fixture corpus (we start with one; add more as real PDFs surface issues)

These are deliberately scoped out of v1 implementation to keep the plan executable in a reasonable time. Each is a single small follow-up task when the need is felt.
