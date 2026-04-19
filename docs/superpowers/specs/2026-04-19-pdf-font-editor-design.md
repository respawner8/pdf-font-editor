# PDF Font Editor — Chrome Extension Design

**Date:** 2026-04-19
**Status:** Design approved, awaiting implementation plan
**Scope:** v1

## Summary

A Chrome MV3 extension that lets a user edit text in local (`file://`) PDFs opened in Chrome while preserving the visual appearance of the original fonts via metric-matched substitutes. Fully client-side. Exports a new PDF on save.

## Goals

- Edit existing text, add new text, delete text, and move/resize text blocks in local PDFs
- Preserve visual fidelity: edited text should be visually indistinguishable from the original at normal zoom
- Fully client-side (no backend); Google Fonts CDN acceptable
- Lowest-friction UX: user clicks the extension icon on a PDF tab, editor opens in a new tab

## Non-goals (v1)

- Web-hosted PDFs (`https://…`), uploaded files, or drag/drop
- Scanned / image-only PDFs (no OCR)
- Image, shape, or signature editing
- Two-column reflow, table cell reflow, RTL languages
- In-place overwrite of the original file
- Draft auto-save or cross-session persistence of in-progress edits (font-substitution choices *are* persisted — see Font matcher)
- Chrome Web Store distribution (out of scope for v1 code; can be decided post-MVP)

## User decisions captured during brainstorm

| # | Decision | Value |
|---|---|---|
| 1 | Edit types | Modify existing, add new, delete, move/resize (no images) |
| 2 | Font fidelity target | Visually indistinguishable at normal zoom |
| 3 | PDF sources | Local `file://` only |
| 4 | Editor open mechanism | Extension-icon click opens editor in new tab |
| 5 | Save flow | Download a new PDF; original untouched |
| 6 | Font sourcing | Bundled core set + Google Fonts CDN |
| 7 | Reflow default | Preserve box + overflow warning; shrink-to-fit is opt-in per text item |

## Architecture

Three tiers of modules:

### Tier 1 — Extension shell (MV3)

- **Service worker.** Listens for action-icon click. Reads active tab URL; if `file://*.pdf`, opens `editor.html?src=<url>` in a new tab.
- **`manifest.json`.** Manifest V3. Permissions: `activeTab`, `storage`, and host permission `file:///*`. User must enable "Allow access to file URLs" on the extensions page.

### Tier 2 — Editor page (in-tab)

- **PDF loader.** `fetch(src)` → `ArrayBuffer`. Surfaces a clear error if file-URL permission is denied.
- **pdf.js render pipeline.** Parses PDF, renders each page to canvas, extracts text layer with per-glyph positions, fonts, and metrics.
- **Editor overlay.** HTML contenteditable layer positioned over the canvas. Per text item: stable `textItemId`, original bbox, assigned substitute font. Inline toolbar for add/delete/move.
- **Edit model.** In-memory operation log (see below). No cross-session persistence in v1.

### Tier 3 — Font + output

- **Font analyzer.** Reads `/Font` dictionary entries. Extracts PostScript name, Flags (serif/sans/mono/italic), Weight, ascent, descent, cap-height, x-height, avg advance, em.
- **Font matcher.** Resolves each original font to a substitute (see dedicated section).
- **pdf-lib writer.** Applies the edit-model op log to the original bytes. Embeds substitute font subsets. Produces new PDF bytes.
- **Download handler.** `Blob` + `a[download]`. Suggests filename `<original>-edited.pdf`. Fallback to `chrome.downloads.download` if blob-link fails.

## Data flow — open → edit → save

1. User opens `file:///.../doc.pdf` in Chrome; clicks extension icon.
2. Service worker opens `editor.html?src=file:///.../doc.pdf`.
3. Editor page: `fetch(src)` → `ArrayBuffer` → pdf.js parses → Font analyzer inspects `/Font` dict.
4. Font matcher resolves each original font → loads bundled or Google Fonts CDN → caches decision keyed by `sha256(pdfBytes) + originalFontName`.
5. Pages render: original rendering on canvas, substitute font applied to the overlay text layer.
6. User edits → edit model records ops → overlay re-renders affected text with the substitute font.
7. On Save: pdf-lib applies ops to the original bytes, embeds needed subsets, produces new PDF bytes → Blob → download.

## Font matcher

### Input per font reference

- PostScript name
- Class flags: serif, sans, mono, script
- Weight (100–900)
- Italic / oblique
- Metrics: ascent, descent, cap-height, x-height, avg advance, em-square

### Resolution pipeline

1. **Registry direct hit.** Bundled map of ~40 common PostScript names → curated substitute (`Helvetica-Bold` → Arimo Bold, `TimesNewRomanPSMT` → Tinos Regular, …). Fast, deterministic.
2. **Metric-match in bundled core.** Score each bundled core family on weighted Euclidean distance in normalized metric space (weight, cap-height, x-height, avg-advance, class). Take best if score is below threshold.
3. **Google Fonts CDN search.** Filter Google Fonts metadata by class + weight; load top N candidates as `FontFace` objects; measure actual metrics via hidden-canvas probe; pick best. Cache in `chrome.storage.local`.
4. **System font fallback.** If offline and no CDN reachable: fall back to `font-family: serif / sans-serif / monospace`; show a "⚠️ approximate font" indicator on affected text.

### Bundled core (v1)

Liberation Sans, Liberation Serif, Liberation Mono, Carlito (Calibri-like), Cousine (Consolas-like), Source Sans 3, Source Serif 4, Noto Sans. All SIL OFL. Combined ~3 MB woff2.

### User override

Per-text-item dropdown to pick any Google Font. Override is saved per-(file-hash + original-font-name) in `chrome.storage.local` so next session uses it.

### Known-unknowable cases

- Heavily customized / licensed fonts with no public analog → best-effort metric match + visible warning
- CJK and complex scripts → out of scope in v1 (Noto Sans covers basic Unicode, but proper CJK matching is its own project)

## Edit model

### Operation types

```
ReplaceTextOp = { op:'replace', pageIdx, textItemId, newText, origFont, substituteFont }
InsertTextOp  = { op:'insert',  pageIdx, x, y, text, font, size, color }
DeleteTextOp  = { op:'delete',  pageIdx, textItemId }
MoveTextOp    = { op:'move',    pageIdx, textItemId, dx, dy }
ResizeTextOp  = { op:'resize',  pageIdx, textItemId, newSize }
```

- `textItemId` is assigned on load per pdf.js text item and is stable for the session.
- Ops are ordered; Save replays them onto the original bytes via pdf-lib.
- Undo / redo = pop / push the op stack.

### Reflow behavior (default)

- **Default:** preserve the original bounding box. If edited text is wider, overflow is shown with a visual warning (`⚠` badge + red outline on the item).
- **Opt-in per item:** right-click → "Shrink to fit" — reduces font size to fit the original box.
- **Not supported in v1:** growing the box and pushing neighbors (unreliable on real PDFs), multi-line wrap inside the original rect (deferred).

### Font embedding on save

- One font subset per substitute per document, not per page.
- Subset = exactly the glyphs used by edited + original text in that font.
- pdf-lib performs the TTF subsetting.

## Error handling

| Failure | Response |
|---|---|
| `file://` fetch denied | Show guidance + direct link to `chrome://extensions` to enable "Allow access to file URLs" |
| PDF parse error (corrupt) | Surface pdf.js error; offer "open in Chrome's default viewer" fallback |
| Password-protected PDF | Prompt for password once; if wrong, show clear error; do not retry silently |
| Font CDN offline | Fall back to bundled core → system default; banner: "⚠️ Some fonts approximated — offline" |
| Edited text uses a font whose subset needs new glyphs | pdf-lib embeds the substitute anew on save; no user-visible error |
| Save fails (popup blocker on Blob download) | Fall back to `chrome.downloads.download`; if still fails, offer copy-as-base64 |
| Very large PDF (> 100 MB) | Warn before loading; stream page-by-page; cap pages held in memory |
| Unsupported glyph in substitute font | Mark glyph with `⚠` in the overlay; user can pick a different font for that run |

### Explicit non-errors

- Opening a non-PDF URL via the extension icon → no-op with a toast
- Opening a PDF with no text layer (scanned image) → show "This PDF has no editable text" and exit gracefully

## Testing

- **Unit (Vitest).** Font matcher scoring is deterministic; edit-model op application + replay is idempotent; pdf.js → `textItemId` assignment is stable across repeated loads of the same PDF.
- **Fixture PDFs.** `test/fixtures/` corpus: Helvetica/Arial doc, Times doc, Calibri doc, Courier doc, a multi-font doc, a weight-variation doc, a password-protected doc, a no-text-layer scanned doc, a ~50 MB doc.
- **Round-trip test.** Load fixture → apply a known op script → save → reload the saved PDF → assert edits present and substitute fonts embedded.
- **Manual E2E checklist** (in README): open-from-file, edit existing text, add new text, delete, move, save, reopen the saved PDF in Chrome, verify visual fidelity.
- **Font-visual test** (manual, scripted). Render "the quick brown fox…" in original font vs substitute side-by-side for the entire bundled core; eyeball at setup.
- **No CI in v1.** Local `npm test` only.

## Open decisions (defer, not blocking)

- Distribution path (Chrome Web Store vs unpacked / private): decide after v1 works locally.
- Whether to add persistent draft auto-save: wait for real-use feedback.
- Whether to support web-hosted PDFs: only if the v1 UX validates interest.

## Dependencies

| Library | Purpose | License |
|---|---|---|
| `pdfjs-dist` | PDF parsing + rendering | Apache-2.0 |
| `pdf-lib` | PDF modification + writing | MIT |
| Liberation / Carlito / Cousine / Source / Noto fonts | Bundled core substitutes | SIL OFL |
| `vitest` | Unit test runner | MIT |

No runtime backend. Google Fonts CDN used optionally at runtime for overflow font matches.
