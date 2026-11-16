# Module: offline-pack

- **Owner:** pair ol (builder), pair ab (service worker and player UI) · **Issues:** #12, #35, #36, #55 · **Requirement:** R5 (+ stretch Braille)
- **Code:** `services/worker/src/pack/` (`offline-pack` job)

## Purpose

Let a learner on a 3G or intermittent connection, possibly with a cheap Android phone, take a lesson offline: audio, text and light HTML.

## Two routes

1. **Static pack (works on any device, no JavaScript):** a zip containing
   - `index.html`: light page (no framework, no required JS), with title, instructions and links
   - `lesson.opus`: audio at about 24 kbps (with AD mixed in as an alternative file)
   - `transcript.html`: accessible transcript (captions + descriptions)
   - `captions.en.vtt`, `captions.am.vtt`
   - optionally `lesson-240p.mp4` when the job is started with `includeVideo: true`
   - optionally `transcript.am.brf` when `includeBraille: true` (experimental Amharic Braille — see below)
2. **PWA route (#36):** service worker + Cache API for the player assets and the lesson files, IndexedDB for settings, transcripts and download state; a "Download for offline" button with progress and a "Remove" button.
   - Player code: `packages/player/src/offline/` (`abol-player.sw.js` built beside the IIFE bundles).
   - Cache name `abol-lesson-v1`; IndexedDB `abol-offline` (stores `lessons`, `settings`).
   - Demo: `packages/player/demo/offline.html` (serve over `http://localhost`).
   - **Host note:** register the SW from the **page origin**. Serve `abol-player.sw.js` next to `abol-player.js` (e.g. `/widget/`). Default SW scope is that directory; for page-wide offline shell coverage, send `Service-Worker-Allowed: /`. The static zip remains the path for `file://` / phone file managers when a SW cannot run.

## Worker job (`offline-pack`, #35)

Depends on ffmpeg renditions (#26) and caption objects (#27 / #28).

```
POST /api/assets/:id/jobs  { "type": "offline-pack", "params": { "title?", "lang?", "langs?", "includeVideo?", "includeBraille?", "brailleTable?" } }
```

| Param | Default | Notes |
|---|---|---|
| `includeVideo` | `false` | Adds `lesson-240p.mp4` |
| `includeBraille` | `false` | Adds experimental `transcript.am.brf` from Amharic captions |
| `brailleTable` | `ethio-g1.ctb` | Liblouis table id |

Storage layout:

| Key | Content |
|---|---|
| `assets/{assetId}/renditions/audio.opus` | Input (required) |
| `assets/{assetId}/captions/{lang}.vtt` | Input (at least one lang; Amharic required if `includeBraille`) |
| `assets/{assetId}/transcript.html` | Reused if present; otherwise generated and stored |
| `assets/{assetId}/descriptions/{lang}.vtt` | Optional visual / AD descriptions folded into transcript HTML (#54) |
| `assets/{assetId}/packs/offline.zip` | Output zip |

### Accessible HTML (#54)

Generated `index.html` / `transcript.html` use semantic structure (`main`, `header`, `nav`, `section`, `footer`), document `lang`, and meaningful titles. Visual descriptions come from description VTT cues when present. Still images are included only when a non-placeholder `alt` is supplied; decorative images use `alt=""`. Experimental PDF: `bash scripts/html-to-pdf.sh path/to/transcript.html`.

### Experimental Amharic Braille (`.brf`, #55)

> **Experimental Amharic Braille output. Linguistic correctness has not yet been independently verified by an Amharic Braille reader.**
> Do not advertise as validated accessibility support.

When `includeBraille: true`:

1. Worker reads `captions/am.vtt` (same VTT parse path as transcript HTML).
2. Each cue (and optional title) is translated with **Liblouis** table **`ethio-g1.ctb`** via `services/worker/scripts/liblouis_translate.py` (Python `louis` bindings).
3. Output is formatted as plain-text BRF (`transcript.am.brf` in the zip): default **40 cells × 25 lines**, CRLF line endings, form-feed page breaks (shared `@abolkit/core` `formatBrf` / worker re-export).
4. `index.html` links the BRF with an “experimental / not independently verified” label.
5. If Liblouis or the table is missing, the job **fails** with a clear error — it does **not** fall back to print Amharic text.

**Player (client-side):** `<abol-player>` can also export `transcript.am.brf` from Amharic caption cues via a lazy GPL companion (`dist/abol-player.braille.js`, npm `liblouis` + `ethio-g1.ctb`). Same experimental framing; main player bundles remain MIT.

**Runtime (worker image / host):**

| Piece | Notes |
|---|---|
| Liblouis | Investigated / target **3.12.0** (Debian `liblouis-data` / `python3-louis`) |
| Table | `ethio-g1.ctb` (wrapper alias `gez.tbl`) |
| Compose worker image | Root `Dockerfile` target `worker` installs `python3`, `python3-louis`, `liblouis-data` |
| Local without packages | Leave `includeBraille` false, or install the same apt packages |

```bash
# Host smoke (engine regression, not linguistic proof)
echo '{"text":"ሰላም","table":"ethio-g1.ctb"}' \
  | python3 services/worker/scripts/liblouis_translate.py
# → {"ok": true, "braille": "s5lam", ...}

# Enable on a pack job
# params: { "includeBraille": true, "langs": ["en", "am"] }
```

**Tests:** `pnpm --filter @abolkit/worker test` — unit tests inject a fake translator; optional Liblouis engine-regression tests skip when `python3-louis` is absent. Full spike notes: [`spikes/55-braille-brf/RESULT.md`](../../spikes/55-braille-brf/RESULT.md).

### Size report

The job result includes both `totalBytes` (zip size) and a structured `sizes` object so the number can appear in the job card, docs and pitch:

```json
{
  "packKey": "assets/…/packs/offline.zip",
  "totalBytes": 184320,
  "brailleFile": null,
  "brailleExperimental": false,
  "sizes": {
    "assetId": "…",
    "packKey": "assets/…/packs/offline.zip",
    "zipBytes": 184320,
    "membersBytes": 210004,
    "files": [
      { "name": "index.html", "bytes": 1200 },
      { "name": "lesson.opus", "bytes": 180000 },
      { "name": "transcript.html", "bytes": 2400 },
      { "name": "captions.en.vtt", "bytes": 900 },
      { "name": "captions.am.vtt", "bytes": 1100 }
    ]
  }
}
```

Target for ~10 minutes of lesson audio at 24 kbps Opus: well under a few MB (see [plan.md](../plan.md)). Video is opt-in because 240p dominates the budget.

## Design notes

- Static pack pages use system fonts plus an Ethiopic-capable fallback (`Noto Sans Ethiopic` / `Nyala`); set `lang` correctly.
- The service worker needs `http://localhost` or HTTPS (not `file://`); say so in docs. The **static** zip is meant for `file://` / phone file managers after unzip.
- Do not depend on Video.js in the pack or audio-only mode.
- Cache versioning: new pack versions replace old caches; the user can always clear storage from the UI.

## Done when

On Slow 3G throttling the pack downloads and opens; with airplane mode the audio and transcript still work; the pack plays from a phone file manager; size is reported on the job result; one real low-end Android test is logged.

### Manual checklist (PWA #36 + phone)

1. Serve player demos over `http://localhost` (not `file://`).
2. Open `packages/player/demo/offline.html`, throttle to Slow 3G, use **Download for offline**.
3. Go offline / airplane mode, reload: audio + captions + transcript still work.
4. **Remove offline copy** clears Cache API + IndexedDB for that lesson.
5. On a real phone: same flow over HTTPS or localhost tunnel; log device, browser, pack/cache size, and pass/fail.

## Test plan

Spike #12 measurements; unit tests for zip + handler; Playwright offline test; manual phone test; Lighthouse PWA check for the PWA route.

## Risks

iOS/Android storage limits and eviction; large video blowing the size budget (make video optional); service-worker bugs masking updates during development; some older Android WebViews struggle with Opus in `<audio>` — the pack always offers a direct download link to `lesson.opus`.
