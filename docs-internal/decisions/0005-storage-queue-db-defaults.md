# 0005: Storage, queue and database defaults

- **Status:** Proposed (to be confirmed by spike #11)
- **Date:** 2026-11-14
- **Deciders:** pair ol, with pair ab reviewing

## Context

The team's first architecture listed Postgres, Redis + BullMQ, Cloudflare R2 and Docker. Each is reasonable in production but adds setup and accounts, and a judge must run the result. Judging favours low cost, no lock-in and a clear README.

## Options

| Concern | Heavier option | Lighter default (proposed) |
|---|---|---|
| Object storage | MinIO / Cloudflare R2 | Local disk behind the `Storage` interface; MinIO and R2 as adapters |
| Queue | Redis + BullMQ (retries, concurrency, separate workers) | DB-backed or in-process queue with retry and progress; BullMQ adapter if the spike shows a need |
| Database | PostgreSQL | SQLite for the demo; Postgres supported through the same data layer if the team prefers |

## Decision (proposed)

Default to the lighter column so `docker compose up` needs the fewest services. Keep the heavier options behind interfaces and document them as production options. Revisit after spike #11 with measured effort and failure behaviour (retry, progress, worker separation).

## Consequences

- Faster setup and fewer failure points for judges and new hosts.
- If we later need horizontal scaling, swap the queue and storage adapters without changing the API.
- Signed URLs for local storage are served by the API with a short-lived token.
