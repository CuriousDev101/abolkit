# 0005: Storage, queue and database defaults

- **Status:** Accepted
- **Date:** 2026-11-14
- **Deciders:** pair ol (spike #11), with pair ab reviewing
- **Supersedes:** the Proposed draft that treated MinIO as an optional production adapter

## 1. Context and problem

Abol Kit’s Level 2 path is an API + worker that uploads media, runs long jobs (ffmpeg, STT, pack building), and serves signed downloads. Judges and hosts must run this from a clean clone with few accounts and few failure points. The first architecture sketch listed Postgres, Redis + BullMQ, Cloudflare R2 and Docker. Each is fine in production; together they are too many moving parts for a two-day hackathon and for “can be kept running” scoring.

Spike #11 settles the **defaults** so `#24` (upload/storage), `#25` (queue), and `#43` (Compose) share one contract. Implementations may land in later issues; this ADR is the decision record.

## 2. Requirements and constraints

- Common `Storage` interface in `@abolkit/provider-sdk` (`put`, `get`, `delete`, `signedUrl` with TTL).
- **MinIO is mandatory** for the intended Compose / demo deployment. It is not an optional production dependency.
- Local-disk storage must also implement the same interface for unit tests and for developers who are not running Docker.
- Queue must support a separate worker process, job status (`queued|running|succeeded|failed`), progress, retry with backoff, and long transcription jobs.
- Database must persist assets/jobs/cues metadata across container restarts.
- Prefer few Compose services; do not add Redis or Postgres without a clear need.
- Align with ADR 0003: cloud adapters that send data off-host stay opt-in; MinIO runs on the host stack (self-hosted object storage).
- Do not implement STT, the player, or extra AI features in this decision.

## 3. Considered alternatives

### Object storage

1. **Local disk only** — simplest, but api and worker containers need a shared volume and signed URLs are custom.
2. **MinIO (S3-compatible, self-hosted)** — real object storage, native presigned URLs, no cloud account.
3. **Cloudflare R2 / other cloud S3** — production option later; needs accounts and `sendsDataOffHost` careful handling.

### Queue

1. **In-process only** — no extra service; weak worker isolation; progress lost if the API process dies mid-job.
2. **DB-backed queue** (poll + lease rows) — separate worker, retry/progress in SQL, no Redis.
3. **Redis + BullMQ** — strong retries/concurrency; adds Redis as a required service.

### Database

1. **SQLite** — one file on a volume; enough for demo write load (API + one worker).
2. **PostgreSQL** — better concurrency; extra Compose service and ops surface for judges.

## 4. Comparison tables

### Storage

| Concern | Local disk only | MinIO (chosen for Compose) | Cloud R2 |
|---|---|---|---|
| Compose services | Shared volume only | **Required `minio` service** | External account |
| Signed URL + expiry | HMAC API route | Presigned S3 URL | Presigned |
| api/worker decoupling | Shared filesystem | Object keys | Object keys |
| Judge setup | Trivial | One container, no cloud key | Account + network |
| Hackathon fit | Tests / no-Docker | **Deploy default** | Later adapter |

### Queue

| Criterion | In-process | **DB-backed (chosen)** | Redis + BullMQ |
|---|---|---|---|
| Retry / backoff | Possible | Yes (`jobs` table) | Yes |
| Progress | Fragile (memory) | `progress` + `status` columns | Yes |
| Worker separation | Poor | API inserts; worker claims rows | Yes |
| Extra Compose service | None | None | Redis required |
| Long STT jobs | Risky | Suitable | Suitable |
| Hackathon fit | Too weak | **Best** | Overkill |

### Database

| Criterion | **SQLite (chosen)** | PostgreSQL |
|---|---|---|
| Setup | File + volume | Extra service |
| Concurrent writes | Limited (API + one worker OK) | Strong |
| Survive restarts | Volume-mounted file | Volume / managed DB |
| Demo / judges | Simplest | More failure surface |

## 5. Final decisions

1. **Storage:** Compose / demo deploy uses **MinIO** (`STORAGE_PROVIDER=minio`). **Local-disk** remains a first-class adapter for tests and no-Docker development. R2 is a future optional adapter, not a default.
2. **Queue:** **SQLite DB-backed** job queue with a **separate worker process/container**. Do **not** introduce Redis + BullMQ for the demo.
3. **Database:** **SQLite** file for application metadata and the job queue. Postgres is a future swap behind the same data layer, not required for `#43`.

## 6. Reasons

- **MinIO mandatory:** S3-compatible API matches how hosts expect media storage; presigned URLs with expiry match the `Storage.signedUrl` contract; api and worker share objects by key without fragile bind-mount layouts; judges get real object storage without paid cloud accounts. Local-disk alone is insufficient as the *deploy* default once api and worker are separate containers.
- **DB-backed queue:** Pipeline jobs (ffmpeg → STT → cues → save) outlive a single HTTP request and need retry/progress. A `jobs` table gives that without Redis. In-process-only fails worker isolation. BullMQ’s benefits do not justify another service for one worker in a two-day build.
- **SQLite:** One volume path, zero extra services, adequate for demo concurrency. Matches “fewest moving parts a judge can run.”

## 7. Consequences and trade-offs

- Compose must include **`api`, `worker`, and `minio`** (plus a shared SQLite volume). Documentation must not call MinIO optional.
- SQLite limits horizontal scale and multi-writer throughput; one worker and careful leases are assumed.
- Queue latency equals poll interval (e.g. 1–2 s); fine for transcription, not for sub-second fan-out.
- Local-disk signed URLs need an API signing secret and route; MinIO uses native presign (internal endpoint vs public endpoint for browser downloads).
- ADR 0003’s “local-disk storage” wording for *privacy defaults* still holds for “no cloud”; **host-local MinIO** is the Compose object store and does not send media to a third-party SaaS.

## 8. Required environment variables

```env
# Storage — Compose default (MinIO is mandatory in docker compose)
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=minio:9000
MINIO_PUBLIC_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=abolkit
MINIO_SECRET_KEY=change-me
MINIO_BUCKET=abolkit-media
MINIO_USE_SSL=false

# Storage — local-disk (tests / no-Docker only)
# STORAGE_PROVIDER=local-disk
# STORAGE_LOCAL_ROOT=./data/storage
# STORAGE_SIGNING_SECRET=change-me

# Database + DB-backed queue
DATABASE_URL=file:./data/abolkit.sqlite
# In containers prefer: DATABASE_URL=file:/data/abolkit.sqlite

# Worker claim / poll (DB-backed queue)
JOB_POLL_INTERVAL_MS=1500
JOB_LEASE_SECONDS=120
JOB_MAX_ATTEMPTS=3
```

Provider selection remains via `STORAGE` / `STORAGE_PROVIDER` consistent with architecture (`TRANSCRIBER`, `TRANSLATOR`, `TTS`, `STORAGE`).

## 9. Local development setup

**With Docker (canonical):** `docker compose up` starts api, worker, and MinIO; set `STORAGE_PROVIDER=minio`; mount/persist `/data` for SQLite and optionally MinIO’s data dir.

**Without Docker:** set `STORAGE_PROVIDER=local-disk`, `STORAGE_LOCAL_ROOT=./data/storage`, `DATABASE_URL=file:./data/abolkit.sqlite`, run api and worker as two Node processes against the same DB file. Use this for unit tests and quick iteration; do not treat it as a substitute for verifying MinIO in Compose before submission.

## 10. Docker deployment implications

Intended Compose services for `#43` (not all implemented in this spike):

| Service | Role |
|---|---|
| `minio` | **Required** object storage (ports 9000 / console optional) |
| `api` | Hono API; writes assets/jobs; issues signed URLs |
| `worker` | Polls jobs; ffmpeg; Transcriber; writes results to Storage + DB |

- Create bucket `abolkit-media` on startup (init script or first-boot ensure).
- Persist SQLite on a named volume so jobs and asset metadata survive restarts.
- Persist MinIO data on a volume so uploaded media survives restarts.
- Do **not** require Redis or Postgres for the demo stack.

## 11. How this supports the audio transcription pipeline

```text
Upload audio
    → Storage.put(assets/{id}/source)     [MinIO in Compose]
    → INSERT job (type=transcribe, queued) [SQLite]
    → worker claims job
    → ffmpeg → Storage.put(.../audio/16k-mono.wav)
    → Transcriber adapter (e.g. abol-mms-stt later; not this ADR)
    → cues in DB + Storage.put(.../captions/{lang}.vtt)
    → job succeeded | failed (+ retry until JOB_MAX_ATTEMPTS)
```

Object key layout:

| Key pattern | Content |
|---|---|
| `assets/{assetId}/source` | Uploaded media |
| `assets/{assetId}/audio/16k-mono.wav` | Normalized audio for STT |
| `assets/{assetId}/renditions/audio.opus` | Offline / low-bandwidth audio |
| `assets/{assetId}/renditions/video-240p.mp4` | Light video rendition |
| `lessons/{lessonId}/captions/{lang}.vtt` | Caption WebVTT |
| `lessons/{lessonId}/descriptions/{lang}.vtt` | Description tracks |
| `lessons/{lessonId}/packs/offline.zip` | Offline pack |

Signed downloads use `Storage.signedUrl(key, ttlSeconds)`: MinIO presign in Compose; local-disk HMAC route when `STORAGE_PROVIDER=local-disk`.

## Interface reminder

Implementations (issue `#24`) must honour `@abolkit/provider-sdk` `Storage`:

- `put` / `get` / `delete`
- `signedUrl(key, ttlSeconds)` with real expiry
- `ProviderInfo.sendsDataOffHost`: `false` for local-disk and host MinIO; `true` only for future off-host object stores

Queue row shape (issue `#25`) at minimum: `id`, `type`, `status`, `progress`, `attempts`, `error`, `result`, `leased_until`, timestamps.
