# Spike 11: storage, queue and database defaults

- **Issue:** #11 · **Owner:** pair ol · **Date:** 2026-11-14 · **Timebox:** docs/decision spike

## Question

Which storage, queue and database defaults let judges run Abol Kit with the fewest reliable moving parts—while keeping MinIO mandatory for Compose?

## Method

Inspected monorepo stubs (`packages/provider-sdk` `Storage` interface; empty `services/api` / `services/worker`), architecture, pipeline module, draft ADR 0005, and issue #11 acceptance criteria. Compared alternatives against hackathon constraints (no STT implementation in this spike). No runtime benchmarks (implementations land in #24 / #25 / #43).

## Results

| Option | Measurement (size, time, accuracy, errors) | Notes |
|---|---|---|
| Local-disk only | N/A (design) | Good for tests; weak as Compose default with split api/worker |
| MinIO | N/A (design) | **Mandatory in Compose** — S3 API, presigned URLs, no cloud account |
| In-process queue | N/A | Insufficient worker isolation for long STT |
| DB-backed queue | N/A | **Chosen** — SQLite `jobs` + separate worker poll/lease |
| Redis + BullMQ | N/A | Rejected for demo — extra service without need |
| SQLite | N/A | **Chosen** for metadata + queue |
| PostgreSQL | N/A | Deferred; extra Compose service |

## Pass criteria met?

- [x] Local-disk and MinIO both specified behind `Storage` (signed URL, expiry) — implementations in #24
- [x] In-process/DB-backed vs Redis+BullMQ compared; DB-backed chosen
- [x] SQLite vs Postgres choice for the demo — SQLite
- [x] ADR 0005 updated to Accepted

## Decision

**Keep:** MinIO (Compose required) + local-disk adapter; SQLite DB-backed queue; SQLite database.  
**Drop for demo:** Redis/BullMQ, Postgres, R2-as-default.  
Full write-up: [`docs-internal/decisions/0005-storage-queue-db-defaults.md`](../../docs-internal/decisions/0005-storage-queue-db-defaults.md).

## Follow-ups

- #24 — LocalDisk + MinIO adapters, upload, signed URLs  
- #25 — job table, worker claim loop, status API  
- #43 — `docker compose` with `api`, `worker`, `minio` + volumes  
- Env template: [`.env.example`](../../.env.example)
