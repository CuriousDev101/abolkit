# Spike / stretch #55: Amharic Braille export (.brf)

- **Issue:** #55 · **Owner:** pair ol · **Depends on:** #28 (nice-to-have; **not** required for this exporter) · **Docs:** `docs-internal/scope.md`, `docs-internal/modules/offline-pack.md`
- **Date:** 2026-11-15 (investigation) · **Updated:** implementation of experimental exporter
- **Decision:** **Ship experimental opt-in exporter; human linguistic verification still pending**

## Warning

> **Experimental Amharic Braille output. Linguistic correctness has not yet been independently verified by an Amharic Braille reader.**
>
> Do not advertise this as validated accessibility support.

## Question

Can Abol Kit export lesson text as Braille Ready Format (`.brf`) for Amharic (Ethiopic script) using Liblouis, with tables available and human verification possible?

## Issue gate (from #55 / `gh-issues.sh`)

> Only if tables for the needed script are available and someone can verify the output.

| Condition | Status |
|---|---|
| **A.** Suitable Amharic/Ethiopic table available | **PASS** — `ethio-g1.ctb` / `gez.tbl` |
| **B.** Knowledgeable Amharic Braille reader verifies output | **PENDING** — not arranged; exporter is labelled experimental |

Product choice: implement the pipeline now (opt-in, documented as experimental) so verification can use real `.brf` samples; do **not** claim Condition B is green.

## Architecture (implemented)

| Piece | Location |
|---|---|
| Liblouis Python bridge | `services/worker/scripts/liblouis_translate.py` |
| Translate (no BRF layout) | `services/worker/src/pack/braille/translate.ts` |
| BRF page layout | `services/worker/src/pack/braille/format-brf.ts` |
| VTT → BRF | `services/worker/src/pack/braille/export-brf.ts` (reuses `@abolkit/core` `parseVtt`) |
| Offline-pack opt-in | `buildOfflinePack({ includeBraille: true })` → zip member `transcript.am.brf` |
| Job params | `includeBraille` (default `false`), optional `brailleTable` |
| Compose worker image | Root `Dockerfile` target `worker` installs `python3`, `python3-louis`, `liblouis-data` |

Default offline packs are unchanged. Failed translation does **not** fall back to print text.

## Liblouis investigation (reference)

| Item | Value |
|---|---|
| Liblouis (Debian/Ubuntu investigated) | **3.12.0** |
| Python bindings | `python3-louis` → `import louis` |
| Ethiopic table | **`ethio-g1.ctb`** (wrapper **`gez.tbl`**) |
| Smoke (engine regression) | `ሰላም` → `s5lam` |

### Engine-regression smoke (not linguistic proof)

```text
Liblouis 3.12.0, table ethio-g1.ctb

'ሰላም' → 's5lam'
'አበባ በፀሐይ ውስጥ ይከፈታል።' → '(5b5ba b5&5<5y ws) yk5f5tal4'
'Hello' → 'Hello'
'ሰላም Hello 123' → 's5lam Hello #abc'
'' → ''
```

## BRF formatting assumptions (configurable)

- Input: Liblouis ASCII computer-braille from `ethio-g1.ctb`.
- Default page: **40 cells × 25 lines**.
- Line endings: **CRLF**; page breaks: **form feed** (`\f`).
- Cue/title blocks separated by a blank line; long lines wrap on spaces then hard-wrap.
- Encoding: UTF-8 bytes of that ASCII braille text.

Successful Liblouis translation ≠ verified literary Amharic Braille.

## How to enable / sample

```bash
# Install (host) — same packages as the Compose worker image
sudo apt-get install -y python3 python3-louis liblouis-data

# Bridge smoke
echo '{"text":"ሰላም","table":"ethio-g1.ctb"}' \
  | python3 services/worker/scripts/liblouis_translate.py

# Offline-pack job params
{ "type": "offline-pack", "params": { "includeBraille": true, "langs": ["en", "am"] } }
```

Tests: `pnpm --filter @abolkit/worker test` (injected translator always; Liblouis engine tests skip if packages missing).

## Human verification still pending

1. Arrange review with an Amharic Braille reader / ATCB contact (#3 logistics).
2. Agree sample set (e.g. `samples/lesson-1` Amharic + punctuation/digits).
3. Review generated `transcript.am.brf` on refreshable display / embosser / NVDA + braille display.
4. Record samples, device/software, corrections, accept/reject **in this file**.
5. Only then remove the “experimental / unverified” product framing.

## What was not claimed

- No WCAG / UEB / Ethiopic Braille standard compliance.
- No human verification log (none exists yet).
- Issue #28 lesson CRUD is **not** a prerequisite; exporter reads caption VTT from storage like the rest of the pack.
