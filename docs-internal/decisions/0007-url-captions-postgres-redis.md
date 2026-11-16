# 0007: URL captions on Postgres + Redis (BullMQ), AssemblyAI and Gemini adapters

- **Status:** Accepted
- **Date:** 2026-11-15
- **Deciders:** team:ab
- **Amends:** [0005](0005-storage-queue-db-defaults.md) for URL captions. Compose no longer runs SQLite for this path. Legacy asset uploads may still set `DATABASE_URL` locally; they are off in Compose.

## Context

`<abol-player>` embeds videos by URL (YouTube or a direct media file). Hosts want captions for those videos without uploading files: the backend should pull the audio, produce a WebVTT transcript, translate it into Amharic, Afaan Oromo, Tigrinya and Afar, and serve all of it fast to any page that embeds the same video.

That brings requirements ADR 0005 did not have:

- Many players and several API instances can ask for the same video at once, so jobs must be deduplicated and shared.
- Transcription can take minutes, and translations fan out per language. Both need retries, backoff and limits on how many run at once.
- Caption reads are frequent and must be cheap.
- The endpoints are public (players call them directly), so they need per-IP rate limits that every API instance agrees on.

## Options considered

1. **Extend SQLite and the DB-backed queue (ADR 0005).** No new services. But SQLite is one file shared by one API and one worker, and it has nowhere to put shared rate-limit counters or a cache.
2. **Postgres for records, Redis for the queue (BullMQ), the cache and rate limits.** Two more Compose services. In return: concurrent writers, a unique index that deduplicates active jobs, BullMQ retries/backoff/concurrency, and one Redis for the cache and the limits.
3. **A hosted queue or database.** Needs accounts and sends more data off-host. Rejected for the same reasons as in ADR 0005.

## Decision

Option 2, for URL captions, in a shared package `@abolkit/caption-store`. Flow: **player → API → worker → MinIO / Postgres / Redis**.

- **Postgres** has three tables. `videos` is keyed by a canonical URL: every YouTube URL form becomes `https://www.youtube.com/watch?v=ID`, and a file URL loses only its fragment. `captions` holds one row per video and language, with the VTT text, the MinIO key and the serving URL. `caption_jobs` records each job. A partial unique index allows one queued or running job per (video, type, language), so repeated requests join that job.
- **Redis** runs the BullMQ queues `captions-transcribe` and `captions-translate`, whose job ids are the `caption_jobs` ids. It also caches VTT text, URL→video lookups and caption lists (with a TTL; the worker clears entries when it writes), and keeps fixed-window rate-limit counters per IP. If Redis is down, reads fall back to Postgres and rate limiting lets requests through.
- **MinIO** keeps each VTT file at `videos/{videoId}/captions/{lang}.vtt` (ADR 0005 storage). Official MinIO images are no longer published, so Compose uses the community build `pgsty/minio` (pinned, overridable with `MINIO_IMAGE`).
- **Sources:** the worker accepts **YouTube and direct media URLs** (mp4, webm, …). Default `CAPTION_ALLOWED_HOSTS=*` so any http(s) host works; operators can tighten the list. For YouTube, the worker prefers **manual or auto-generated VTT** via yt-dlp (`--write-subs` / `--write-auto-subs`) and only falls back to AssemblyAI (or the configured `TRANSCRIBER`) when no usable VTT is found.
- **Language:** if the request sends `sourceLanguage`, the worker trusts it. If not, it always assumes `CAPTION_DEFAULT_SOURCE_LANGUAGE` (English). That code is the transcript language stored in Postgres and the language AssemblyAI is told; detection is off by default. Translations always start from the **source transcript VTT**, never from another translation.
- **Providers (ADR 0003):**
  - `TRANSCRIBER=assemblyai` is the Compose default for URL captions. MMS remains available as a self-hosted adapter.
  - `TRANSLATOR=gemini` is the Compose default. It sends only the caption text, as numbered lines, and copies every start and end time from the source cues. A reply that skips or merges lines is rejected and not used.
  - Off-host consent defaults **on** for this path (`TRANSCRIBER_OFF_HOST_CONSENT=true`, `TRANSLATOR_OFF_HOST_CONSENT=true`). Set either to `false` to refuse cloud providers.
- **API:** `POST /api/captions/transcribe`, `/translate` and `/generate` start jobs. `GET /api/captions?url=`, `/api/videos/{id}/captions/{lang}` (text/vtt) and `/api/caption-jobs/{id}` read results. These endpoints need **no API key**. They are rate limited per IP.
- **Player:** this runs only when the host sets both `caption-api` and a valid `generate-captions` attribute (`""` for the transcript only, or a list such as `"am om ti aa"`). If any language in the list is unknown, the player sends no requests. When `lang` or `captions-lang` is set, the player passes it as `sourceLanguage`.

## Consequences

- Compose has five services (postgres, redis, minio, api, worker). No SQLite volume. Captions need `POSTGRES_URL` and `REDIS_URL`; without them the caption endpoints answer 503.
- Legacy asset upload routes answer 503 unless `DATABASE_URL` is set (local / optional).
- Machine output is `needsReview` in the VTT (the `needsReview` cue setting). Per `scope.md`, do not promise quality for om/ti/aa until reviewers have checked samples.
- yt-dlp ships in the worker image and needs a JavaScript runtime (Node is there). YouTube may block server IPs; `YTDLP_COOKIES_FILE` is the escape hatch.
- Exit criteria: if deduplicating jobs, the cache or the rate limits cause more trouble than they save at hackathon scale, fall back to Option 1 and accept one API instance.

## Evidence

- BullMQ 6 (`Queue`, `Worker`, `UnrecoverableError`, custom job ids), ioredis 6, pg 8.
- AssemblyAI REST: `/v2/upload`, `/v2/transcript` (speech_models, language_code, punctuate, format_text, …), `/v2/transcript/{id}/vtt?chars_per_caption=`.
- Gemini `generateContent` with `responseMimeType: application/json` and `responseJsonSchema`.
- Tests: `packages/provider-sdk` (adapters, keeping timestamps), `packages/caption-store` (URL identity, config), `services/api/src/captions.test.ts` (endpoints, dedup, limits).
