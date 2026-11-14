# Module: offline-pack

- **Owner:** pair ol (builder), pair ab (service worker and player UI) · **Issues:** #12, #35, #36 · **Requirement:** R5

## Purpose

Let a learner on a 3G or intermittent connection, possibly with a cheap Android phone, take a lesson offline: audio, text and light HTML.

## Two routes

1. **Static pack (works on any device, no JavaScript):** a zip containing
   - `index.html`: light page (no framework, no required JS), with title, instructions and links
   - `lesson.opus`: audio at about 24 kbps (with AD mixed in as an alternative file)
   - `transcript.html`: accessible transcript (captions + descriptions)
   - `captions.en.vtt`, `captions.am.vtt`
   - optionally `lesson-240p.mp4`
2. **PWA route:** service worker + Cache API for the player assets and the lesson files, IndexedDB for settings, transcripts and download state; a "Download for offline" button with progress and a "Remove" button.

## Design notes

- The pack builder is a worker job (`offline-pack`) that reports the **total size**; the number appears in the job result, docs and pitch.
- Static pack pages use system fonts plus an embedded or system Ethiopic font fallback; set `lang` correctly.
- The service worker needs `http://localhost` or HTTPS (not `file://`); say so in docs.
- Do not depend on Video.js in the pack or audio-only mode.
- Cache versioning: new pack versions replace old caches; the user can always clear storage from the UI.

## Done when

On Slow 3G throttling the pack downloads and opens; with airplane mode the audio and transcript still work; the pack plays from a phone file manager; size is reported; one real low-end Android test is logged.

## Test plan

Spike #12 measurements; Playwright offline test; manual phone test; Lighthouse PWA check for the PWA route.

## Risks

iOS/Android storage limits and eviction; large video blowing the size budget (make video optional); service-worker bugs masking updates during development.
