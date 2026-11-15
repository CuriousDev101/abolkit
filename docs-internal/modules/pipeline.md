# Module: pipeline (API + worker)

- **Owner:** pair ol · **Issues:** #7, #8, #9, #10, #16, #17, #24-28, #30, #32, #54, #57 · **Requirement:** transcript pipeline, R6
- **Code:** `services/api`, `services/worker`, `packages/provider-sdk`

## Purpose

Turn one uploaded video into captions (English and Amharic), a transcript, audio description assets, renditions and an offline pack, with a **human review step** before anything is called final.

## Flow

```
upload ─► asset ─► job: extract audio (ffmpeg, 16 kHz mono)
                     ─► transcribe (Transcriber adapter) ─► cues [needsReview]
                     ─► translate EN<->AM (optional adapter) ─► cues [needsReview]
                     ─► human review in review-editor ─► approved WebVTT
                     ─► renditions: Opus 24 kbps audio, 240p video
                     ─► AD clips (TTS adapter or recorded) + clip manifest
                     ─► transcript HTML (accessible, image descriptions)
                     ─► offline pack zip (+ size report)
```

## Design

- **API (Hono + `@hono/zod-openapi`):** schemas in Zod generate the OpenAPI spec; Scalar docs at `/docs`. Endpoints listed in [architecture.md](../architecture.md). Consistent JSON errors, CORS for reads, API key for writes.
- **Jobs:** id, type, status (`queued|running|succeeded|failed`), progress, error, result links. Retry with backoff. Worker is a separate process/container. Queue choice per [ADR 0005](../decisions/0005-storage-queue-db-defaults.md).
- **Providers:** only through `@abolkit/provider-sdk` ([ADR 0003](../decisions/0003-providers-and-privacy.md)). Config selects `TRANSCRIBER`, `TRANSLATOR`, `TTS`, `STORAGE`. Compose uses **MinIO** (mandatory) + SQLite DB-backed queue ([ADR 0005](../decisions/0005-storage-queue-db-defaults.md)); STT/TTS defaults stay self-hosted / offline.
- **Transcription (#27):** the `transcribe` job runs ffmpeg, then the configured `Transcriber`, and stores WebVTT at `assets/{id}/captions/{lang}.vtt`. Every cue is forced to `needsReview`. `params.language` accepts `en` (default) or `am`; anything else fails without retry. `TRANSCRIBER=cloud` is off by default and refuses to start unless `TRANSCRIBER_OFF_HOST_CONSENT=true`. Only unreachable or 5xx provider errors are retried.
- **ffmpeg recipes** (spike #9): extract audio for STT; `libopus` at about 24 kbps; 240p H.264 rendition; AD mix with `adelay`/`amix` and ducking.
- **Demo safety:** pre-compute the demo lesson and commit results to `samples/`; live runs are a bonus, never a dependency.
- **Documents (R6):** accessible HTML first (semantic headings, alt text, `lang`); tagged PDF only as stretch (#54) via Chromium print-to-PDF plus a checker; image descriptions drafted by a model are reviewed by a human.

## Done when

Upload → transcript cues → reviewed WebVTT → manifest works end to end from `docker compose up`; machine cues are flagged; failure leaves a retryable job; OpenAPI spec validates and a typed client can be generated.

## Test plan

Unit tests for adapters (fake providers), integration test with a short clip, job retry test, spec validation.

## Risks

Weak Amharic STT/translation; slow CPU transcription; model download size in Docker; provider language lists change. Mitigate with review step, pre-computed demo, honest pitch.

## Open questions

STT default settled in spike #7 (`mms-http`). TTS default settled in spike #8 (`recorded-clips` + text AD fallback). Do we need translation at all if captions are human-supplied?
