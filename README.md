# PDF Font Editor

A Chrome extension that lets you edit text in local PDFs while preserving the original fonts via metric-matched substitutes. Fully client-side.

## Build and install

```bash
npm install
npm run build
```

1. Open `chrome://extensions` → enable **Developer mode**
2. Click **Load unpacked** → select the `dist/` directory
3. Click the extension's **Details** → enable **Allow access to file URLs**

## Use

1. Open any local `file:///…/something.pdf` in Chrome
2. Click the extension icon
3. A new tab opens with the editable version
4. Click any word to edit
5. Toolbar: **Undo**, **Redo**, **Add text** (click-to-place), **Save**
6. `Alt+drag` moves a text item; `[` / `]` resize it
7. Right-click an overflowing item → **Shrink to fit**
8. Click **Save** to download the edited PDF

## Manual E2E checklist

- [ ] Open a PDF with Helvetica / Arial text → edits render in Arimo, visually close at 100% zoom
- [ ] Open a Times PDF → substitute is Tinos
- [ ] Open a Calibri PDF → substitute is Carlito
- [ ] Open a monospace-heavy PDF → substitute is Cousine
- [ ] Edit, save, reopen the saved PDF in Chrome → edits persist
- [ ] Delete a word with `Cmd`/`Ctrl` + `Backspace` → word disappears on save
- [ ] Click **Add text**, click on the page, type → appears in saved PDF
- [ ] `Alt+drag` a text item → position updates in saved PDF
- [ ] Resize with `[` / `]` → font-size change persists
- [ ] Overflow warning appears when edited text exceeds original bounding box
- [ ] Right-click → **Shrink to fit** restores layout
- [ ] **Undo** reverts the last edit
- [ ] Offline: open a PDF with no matching core font → offline banner appears
- [ ] Open a scanned / image-only PDF → "no editable text" message
- [ ] Open a password-protected PDF → prompted; correct password opens; wrong password shows clear error
- [ ] Open a > 100 MB PDF → confirm dialog appears

## Development

```bash
npm run dev          # vite dev build (watches)
npm test             # vitest
npm run test:watch   # watch mode
```

## Architecture

- **Render:** Mozilla `pdf.js`
- **Write:** `pdf-lib` with `@pdf-lib/fontkit`
- **Font matcher:** PostScript-name registry → bundled core (metric-matched) → Google Fonts CDN → system font
- **Edit model:** in-memory op log (replace / insert / delete / move / resize) with undo / redo
- **Overlay:** contenteditable text layer positioned over the canvas; canvas shows original, overlay shows edits in the substitute

The design spec is at `docs/superpowers/specs/2026-04-19-pdf-font-editor-design.md`. The implementation plan is at `docs/superpowers/plans/2026-04-19-pdf-font-editor.md`.

## Known limitations (v1)

- Local `file://` PDFs only (no web-hosted, no uploads)
- Text editing only — no images, shapes, or signatures
- No OCR — scanned PDFs are read-only
- Single-line edits preserve the original bounding box; multi-line reflow is not supported
- CJK and complex scripts get best-effort substitution only

## Known issues / follow-ups

- Bundled fonts are `woff2`; pdf-lib's woff2 embed depends on `@pdf-lib/fontkit` version. If the embed fails, Helvetica is used as a graceful fallback. Switching to TTF files would remove the dependency.
- The font cache (`src/fonts/cache.ts`) is wired but not yet used in the matcher — font decisions are recomputed each load. Low-cost follow-up.
- No per-text-item font override dropdown yet — the resolution pipeline picks automatically.
- Fixture corpus is a single `hello.pdf`. Expand when real PDFs surface issues.

## License

MIT
