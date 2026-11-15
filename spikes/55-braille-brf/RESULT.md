# Spike / stretch #55: Amharic Braille export (.brf)

- **Issue:** #55 · **Owner:** pair ol · **Depends on:** #28 · **Docs:** `docs-internal/scope.md`
- **Date:** 2026-11-15
- **Decision:** **Blocked — do not ship an exporter yet**

## Question

Can Abol Kit export lesson text as Braille Ready Format (`.brf`) for Amharic (Ethiopic script) using Liblouis, with tables available and human verification possible?

## Issue gate (from #55 / `gh-issues.sh`)

> Only if tables for the needed script are available and someone can verify the output.

Both conditions are required.

## Existing architecture (Phase 1)

| Piece | Status |
|---|---|
| Offline pack HTML / transcript (#35 / #54) | Present — `services/worker/src/pack/` generates accessible `transcript.html` from caption (+ description) VTT |
| Lesson text source | Caption WebVTT under `assets/{id}/captions/{lang}.vtt`; sample Amharic in `samples/lesson-1/am.vtt` |
| #28 lesson manifest / cue CRUD API | **Not implemented** on `main` (no `services/api/src/routes/lessons*`); pack already reads caption objects from storage |
| Braille / Liblouis in repo | **None** before this spike |
| Preferred integration (if unblocked) | Worker or small script that reads reviewed Amharic caption/transcript text → Liblouis → `.brf` object under `assets/{id}/exports/` — **not** a parallel pipeline |

No Python Braille package is currently a monorepo dependency; system Liblouis was inspected for this investigation only.

## Liblouis investigation (Phase 2)

### Installed environment (this machine)

| Item | Value |
|---|---|
| `liblouis20` (Debian/Ubuntu) | `3.12.0-3ubuntu0.2` |
| `liblouis-data` | `3.12.0-3ubuntu0.2` |
| Python bindings `import louis` | `3.12.0` (`/usr/lib/python3/dist-packages`) |
| `lou_translate` CLI | **Not installed** (`liblouis-bin` package absent) |
| Upstream tables listing | Confirms `ethio-g1.ctb` and `gez.tbl` in [liblouis tables Makefile](https://github.com/liblouis/liblouis/blob/master/tables/Makefile.am) |

### Amharic / Ethiopic tables (actual files — not invented)

| Identifier | Path | Role |
|---|---|---|
| **`ethio-g1.ctb`** | `/usr/share/liblouis/tables/ethio-g1.ctb` | Ethiopic Grade 1 letters + punctuation; includes Latin chardefs + 6-dot digits |
| **`gez.tbl`** | `/usr/share/liblouis/tables/gez.tbl` | Index wrapper (`#+locale:gez`, grade 1) that `include`s `ethio-g1.ctb` |

Table header credits **Dr. Tamru E. Belay** (Adaptive Technology Center for the Blind / ATCB) and Mesar Hameed. There is **no** separate `amh*.ctb` / `amharic*.ctb` in Liblouis 3.12 / upstream listing — Ethiopic literary braille for Amharic is this shared Ethiopic table (metadata locale tag is `gez`).

Metadata caveats in `gez.tbl` itself: liblouis maintainers marked locale/display metadata as **unverified TODO** pending table-author confirmation and braille-specs docs.

### Smoke translations (automated only — not linguistic proof)

```text
Liblouis 3.12.0, table ethio-g1.ctb (== gez.tbl for these inputs)

'ሰላም' → 's5lam'
'አበባ በፀሐይ ውስጥ ይከፈታል።' → '(5b5ba b5&5<5y ws) yk5f5tal4'
'Hello' → 'Hello'          (Latin left as Latin via en-chardefs)
'ሰላም Hello 123' → 's5lam Hello #abc'
'' → ''
```

All **41** unique Ethiopic code points in `samples/lesson-1/am.vtt` produced a non-identity translation under `ethio-g1.ctb` (no hard failures). Output is ASCII braille computer notation suitable as a BRF *starting point*, not a verified literary BRF layout (line length, page breaks, title pages, etc. were not designed).

English-only UEB (`en-ueb-g1.ctb`) does **not** map Ethiopic letters to braille cells (escapes / passthrough) — use `ethio-g1.ctb` / `gez.tbl` for Amharic script.

## Feasibility gate (Phase 3)

| Condition | Result | Evidence |
|---|---|---|
| **A.** Suitable Amharic/Ethiopic table available | **PASS** | `ethio-g1.ctb` / `gez.tbl` installed; smoke translate works on sample Amharic |
| **B.** Knowledgeable Amharic Braille reader / a11y specialist can verify output | **FAIL** | No arranged verifier; team notes in scope that specialist help is needed for ESL/co-designer work; **no human BRF review performed**; fabricating verification is forbidden |

**Decision: do not implement a `.brf` exporter in the product pipeline.** Issue #55 remains open / blocked. Automated translation ≠ correct Amharic Braille.

## What was *not* done

- No Liblouis dependency added to `package.json` / Docker images
- No worker job, API route, or `.brf` writer
- No claim of WCAG, UEB, or Ethiopic Braille standard compliance
- No human verification log (none exists)

## Steps to unblock implementation

1. **Arrange verification** with an Amharic Braille reader or ATCB / Ethiopian blind-org contact (issue #3 organiser path). Get permission to name them in docs.
2. Agree sample set: e.g. `samples/lesson-1` Amharic captions + 2–3 short controlled sentences covering punctuation and digits.
3. Produce draft BRF offline (Liblouis `ethio-g1.ctb`) and review on a refreshable display / embosser / NVDA + braille display.
4. Record: samples checked, device/software, corrections, accept/reject.
5. Then implement a **small** exporter next to the pack/transcript path:
   - Input: reviewed Amharic plain text or VTT cues (#28 when available)
   - Table: `ethio-g1.ctb` (document `gez.tbl` alias)
   - Output: `assets/{id}/exports/transcript.am.brf`
   - Tests: empty input, missing table, mixed Latin+Ethiopic, digits — plus **link to human verification record**
6. Ensure Compose/deploy installs `liblouis-data` (and Python `louis` or `lou_translate`) if the exporter is Python/CLI-based; Node would need a subprocess — keep it minimal.

## Deployment note

Hackathon Compose images today do **not** include Liblouis. Even after verification, image size and licensing (LGPL) must be considered before making Braille a default Compose feature.

## Follow-ups

- #28 lesson/cue API still needed for a clean “export reviewed Amharic” product path.
- Contact list for Braille verification should be tracked with #3 / co-designer logistics.
- Re-open implementation only after Condition B is green and recorded here.
