# Module: offline-pack

- **Owner:** pair ol (builder), pair ab (service worker and player UI) · **Issues:** #12, #35, #36 · **Requirement:** R5
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
2. **PWA route:** service worker + Cache API for the player assets and the lesson files, IndexedDB for settings, transcripts and download state; a "Download for offline" button with progress and a "Remove" button.

## Worker job (`offline-pack`, #35)

Depends on ffmpeg renditions (#26) and caption objects (#27 / #28).

```
POST /api/assets/:id/jobs  { "type": "offline-pack", "params": { "title?", "lang?", "langs?", "includeVideo?" } }
```

Storage layout:

| Key | Content |
|---|---|
| `assets/{assetId}/renditions/audio.opus` | Input (required) |
| `assets/{assetId}/captions/{lang}.vtt` | Input (at least one lang) |
| `assets/{assetId}/transcript.html` | Reused if present; otherwise generated and stored |
| `assets/{assetId}/descriptions/{lang}.vtt` | Optional visual / AD descriptions folded into transcript HTML (#54) |
| `assets/{assetId}/packs/offline.zip` | Output zip |

### Accessible HTML (#54)

Generated `index.html` / `transcript.html` use semantic structure (`main`, `header`, `nav`, `section`, `footer`), document `lang`, and meaningful titles. Visual descriptions come from description VTT cues when present. Still images are included only when a non-placeholder `alt` is supplied; decorative images use `alt=""`. Experimental PDF: `bash scripts/html-to-pdf.sh path/to/transcript.html`.

### Size report

The job result includes both `totalBytes` (zip size) and a structured `sizes` object so the number can appear in the job card, docs and pitch:

```json
{
  "packKey": "assets/…/packs/offline.zip",
  "totalBytes": 184320,
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

## Test plan

Spike #12 measurements; unit tests for zip + handler; Playwright offline test; manual phone test; Lighthouse PWA check for the PWA route.

## Risks

iOS/Android storage limits and eviction; large video blowing the size budget (make video optional); service-worker bugs masking updates during development; some older Android WebViews struggle with Opus in `<audio>` — the pack always offers a direct download link to `lesson.opus`.
