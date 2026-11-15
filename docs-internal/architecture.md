# Architecture

Principle: **components work alone in any host; the backend is an optional service** for generating and managing captions, descriptions and packs. A host that only wants the player needs only a script tag and static files.

## Overview

```
 Host page (Savanna static page / any site)
   <script src=".../abol-player.js">  <abol-player manifest="/lessons/1.json">
        │ reads manifest + VTT + audio (static files OR API)
        ▼
 ┌──────────────── Abol Kit ─────────────────┐
 │ packages/player (custom element, Shadow)  │
 │   MediaEngine ── Video.js adapter (native fallback)
 │   captions overlay · sign window · AD · transcript · settings
 │ packages/job-card   packages/core (VTT, Cue)
 └────────────────────────────────────────────┘
        ▲ optional HTTP (Level 2, OpenAPI)
 ┌──────┴──────── services ───────────────────┐
 │ api (Hono, zod-openapi)  ── jobs ──► worker │
 │   assets · lessons · cues · packs · credentials
 │ worker: ffmpeg → STT → translate → TTS → pack builder
 │ providers (packages/provider-sdk): Transcriber, Translator, Tts, Storage
 └─────────────────────────────────────────────┘
  Defaults: MinIO (required in Compose) + SQLite + DB-backed job queue + self-hosted models.
  Local-disk Storage adapter for tests / no-Docker. Optional later: R2, Redis+BullMQ, Postgres,
  AssemblyAI/cloud TTS (consent required for off-host providers; see ADR 0003 / 0005).
```

## Components

| Component | Tech | Owner pair |
|---|---|---|
| `packages/core` | Pure TypeScript | ab |
| `packages/player` | Custom element, Shadow DOM, Preact or plain TS, Video.js behind `MediaEngine`, IIFE build | ab |
| `packages/job-card` | Custom element, JSON-LD | ol |
| `packages/provider-sdk` | TypeScript interfaces | ol (ab reviews) |
| `services/api` | Hono, `@hono/zod-openapi`, Scalar docs | ol |
| `services/worker` | Node + ffmpeg + provider adapters | ol |
| `apps/docs` | Starlight | ol (ab writes player pages) |
| `apps/review-editor` | Small web app | ol |
| `apps/host-demo` | Savanna copy + plain page | ab |

UI framework (Preact vs plain TS) is chosen per component by size budget. `@videojs/react` implies React or a compat alias; decide in #5/#18.

## Data contracts (shared by both pairs)

### Lesson manifest (`GET /api/lessons/:id` or a static JSON file)

```json
{
  "id": "lesson-1",
  "title": "Intro lesson",
  "lang": "en",
  "media": { "video": "…/lesson.mp4", "audio": "…/lesson.opus", "poster": "…/poster.jpg" },
  "captions": [
    { "lang": "en", "label": "English", "src": "…/en.vtt", "default": true },
    { "lang": "am", "label": "አማርኛ", "src": "…/am.vtt" }
  ],
  "descriptions": [
    { "lang": "en", "src": "…/ad.en.vtt", "clips": "…/ad.en.json" }
  ],
  "sign": { "lang": "ets", "src": "…/sign.mp4", "placeholder": true },
  "transcript": { "src": "…/transcript.html" },
  "offlinePack": "…/pack.zip"
}
```

All fields except `media.video` and one caption track are optional; the player hides features whose data is missing. `ets` is the ISO 639-3 code for Ethiopian Sign Language (verify). `placeholder: true` makes the player show a visible "sample content" note.

### AD clip manifest (`ad.<lang>.json`)

```json
[{ "id": "ad-001", "start": 12.0, "end": 14.5, "text": "A slide shows …", "audio": "ad-001.opus", "pauseVideo": false }]
```

### Cue (in `@abolkit/core`)

`{ id?, start, end, text, needsReview? }`, seconds as numbers. WebVTT is the wire format for captions and descriptions.

## API surface (OpenAPI generated from Zod)

| Method and path | Purpose |
|---|---|
| `GET /api/health` | Liveness |
| `GET /openapi.json`, `GET /docs` | Spec and Scalar docs |
| `POST /api/assets` | Upload media (multipart) → `{ id }` |
| `GET /api/assets/:id` | Metadata or signed download |
| `POST /api/assets/:id/jobs` | Start `transcribe`, `translate`, `describe-tts`, `offline-pack` |
| `GET /api/jobs/:id` | Status, progress, errors, result links |
| `GET /api/lessons/:id` | Manifest |
| `GET/PUT /api/lessons/:id/captions/:lang` | Cues as VTT (put marks reviewed) |
| `GET/PUT /api/lessons/:id/descriptions/:lang` | Description cues |
| `GET /api/lessons/:id/offline-pack` | Pack download |
| `POST /api/credentials`, `GET /api/credentials/:id` | Issue and fetch Open Badges 3.0 credential |
| `GET /verify/:id` | Public verify page |

Errors: JSON `{ error: { code, message } }`. CORS open for read endpoints; write endpoints protected by a simple API key from config.

## Custom element contract (`<abol-player>`)

- **Attributes (simple use, no manifest):** `src` (video), `poster`, `captions` (default caption VTT), `captions-lang`, `captions-label`, `descriptions` (AD VTT), `sign` (sign-language video), `sign-placeholder`, `transcript` (HTML; generated from captions when absent), `audio` (low-bandwidth audio-only version). More caption languages as `<track kind="captions" srclang label src>` children.
- **Attributes (general):** `manifest` (URL; attributes override its fields), `lang`, `controls-keys="off|focus"`, `engine="native"`, `crossorigin`, `api-base`, `autoplay` (ignored; never autoplay).
- **Events:** `abol:ready`, `abol:error`, `abol:caption-change`, `abol:description-toggle`, `abol:sign-toggle`.
- **CSS variables:** `--abol-accent`, `--abol-bg`, `--abol-fg`, `--abol-radius`. Everything else stays inside Shadow DOM.
- **Methods:** `play()`, `pause()`, `seek(s)`.

## Cross-cutting rules

**Accessibility:** real HTML controls, visible focus, no keyboard traps, 44 px targets, single-key shortcuts only on focus and switchable off, status changes via live regions, `lang` on all non-English text, nothing time-limited, honours reduced motion.

**Privacy (ADR 0003):** defaults send nothing off the host. An adapter with `sendsDataOffHost: true` requires explicit opt-in and a consent notice. Uploaded media has a retention setting and signed, expiring URLs. No analytics, no third-party scripts or fonts at runtime (self-host Noto Sans Ethiopic).

**Performance:** budgets in [plan.md](plan.md); player lazy-loads heavy parts; offline pack works with no JavaScript.

**Security:** validate uploads (type, size), parameterised queries, secrets only from environment, no private keys in git, least-privilege API key for writes.

**Failure modes:** missing caption/sign/AD data hides the feature, never breaks playback; API down means the player still plays static files; STT failure leaves a job in `failed` with a retry.

## Deployment

`docker compose up` runs **api**, **worker**, and **MinIO** (mandatory object storage) from a clean clone, with SQLite on a persisted volume for metadata and the DB-backed job queue (ADR 0005). Environment variables select providers (`TRANSCRIBER`, `TRANSLATOR`, `TTS`, `STORAGE` / `STORAGE_PROVIDER`). Default STT is `TRANSCRIBER=mms-http` with `TRANSCRIBER_URL` pointing at the external MMS ASR wrapper (spike #7; model not in this repo). Built bundles are served from the API at `/widget/*` for the script-tag install, and attached to releases for CDN use.
