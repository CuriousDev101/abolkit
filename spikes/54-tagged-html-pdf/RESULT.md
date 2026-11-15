# Spike / stretch #54: tagged HTML / PDF with image descriptions

- **Issue:** #54 · **Owner:** pair ol · **Depends on:** #35 · **Timebox:** 90 minutes
- **Date:** 2026-11-15

## Question

Can we ship accessible HTML documents (with image / visual descriptions) from the offline-pack pipeline, and can Chromium print-to-PDF produce a tagged PDF that passes an accessibility checker?

## What we built (HTML — primary)

Extended `#35` pack HTML (`services/worker/src/pack/html.ts`):

- Semantic `main` / `header` / `nav` / `section` / `footer` and heading hierarchy
- Document `lang` + meaningful `<title>`
- Caption tracks as ordered lists; optional **visual description** tracks from `assets/{id}/descriptions/{lang}.vtt`
- Still images only when metadata provides a **real** `alt` (rejects `image` / `picture` / `image 1`); decorative → `alt=""`
- Optional long description via `aria-describedby` when supplied
- Unit tests in `html.test.ts`

## Chromium PDF experiment

Command:

```bash
bash scripts/html-to-pdf.sh /tmp/abolkit-54/transcript.html /tmp/abolkit-54/transcript.pdf
```

Findings (this machine: Chromium 137; `pdfinfo` / `pdftotext` available; **PAC not installed** — Windows/macOS GUI checker):

| Check | Result |
|---|---|
| PDF opens / renders | Yes |
| Text extractable (`pdftotext`) | Yes — headings, captions, visual descriptions, figure alt text |
| `pdfinfo` Tagged flag | **yes** (Chromium 137 / Skia) |
| `/StructTreeRoot` in file | **Found** |
| PAC / PDF/UA audit | **Not run** (PAC unavailable on this Linux host) |
| Claim PDF/UA compliance | **No** — tagged flag ≠ WCAG/PDF/UA pass; validate with PAC before pitching |

### Manual PAC validation (when available)

1. Generate PDF with `scripts/html-to-pdf.sh`.
2. Open in [PAC](https://pac.pdf-accessibility.org/) on Windows/macOS.
3. Expect failures around missing document structure / tags unless a future tagged-PDF tool replaces Chromium print.

## Decision

- **Keep / ship:** accessible HTML path in the offline pack (R6 HTML).
- **Experimental only:** Chromium PDF helper script may emit a structure tree (`Tagged: yes` on Chromium 137) but is **not** validated as PDF/UA; run PAC before any accessibility claim.
- **Do not** invent image descriptions; reuse AD / description VTT and explicit alt metadata only.

## Follow-ups

- Wire reviewed description VTTs from the review editor (#29) into `assets/{id}/descriptions/`.
- If tagged PDF becomes P0: evaluate a dedicated tagged-PDF library or Acrobat/preflight workflow — not headless Chromium alone.
