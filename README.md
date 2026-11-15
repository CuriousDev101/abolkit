# Abol Kit

> Everyone gets a cup. An accessible learning-media toolkit for the ALX Ethiopia Accessibility Hackathon 2026, **Track 2: accessible learning media**. Team **Abol** (pairs **ab** and **ol**).

Abol Kit is a set of drop-in modules that any learning platform can install:

- `<abol-player>`: an embeddable video player that works by keyboard and screen reader, with resizable/recolourable English and Amharic captions, a movable and resizable sign-language window, audio description, transcripts and an offline option.
- A **captions pipeline** (API + worker): turns a video into captions, transcript, audio description and a small offline pack for a 3G phone, with a human review step.
- `<abol-job-card>` and **verifiable certificate links** (career gateway).

The first host is the ALX **Savanna** learning platform; the modules must also install on any other site.

## Install levels (from the hackathon brief)

| Level | How | Ours |
|---|---|---|
| 1 | One `<script>` tag | `<abol-player>`, `<abol-job-card>` |
| 2 | REST API with OpenAPI spec | `services/api` (docs at `/docs`) |
| 3 | A standard | schema.org/JobPosting, Open Badges 3.0 |

## Repo layout

```
packages/   core (VTT, types), provider-sdk (adapters), player, job-card
services/   api (Hono + zod-openapi), worker (ffmpeg, STT, TTS, packs)
apps/       docs (Starlight), host-demo (Savanna copy + plain page), review-editor
samples/    demo clip and source texts      spikes/   timeboxed experiments + RESULT.md
docs-internal/   scope, architecture, ownership, plan, modules, conformance, decisions
scripts/    gh-labels.sh, gh-issues.sh
```

## Local development (Docker) — issue #43

One command starts **MinIO** (object storage), the **API**, the **worker**, and loads **sample lesson data** into storage.

### Prerequisites

- Docker Engine with **Compose V2** (`docker compose version`)
- Ports free: `8787` (API), `9000` (MinIO), `9001` (MinIO console)

### Quick start

```bash
git clone https://github.com/CuriousDev101/abolkit.git
cd abolkit
cp .env.example .env
docker compose up --build
```

Compose uses safe local defaults from [`compose.yaml`](compose.yaml). Editing `.env` is optional unless you want to override keys or ports.

### Access

| What | URL |
|---|---|
| API health | http://localhost:8787/api/health |
| OpenAPI docs (Scalar) | http://localhost:8787/docs |
| OpenAPI JSON | http://localhost:8787/openapi.json |
| Demo asset (seeded) | http://localhost:8787/api/assets/00000000-0000-4000-8000-000000000001 |
| MinIO S3 API | http://localhost:9000 |
| MinIO console | http://localhost:9001 |

Default write API key (change in `.env` if you share the stack): `dev-api-key-change-me`  
Header: `X-API-Key: dev-api-key-change-me`

Default MinIO login: user `abolkit` / password `change-me` (must be ≥8 characters).

Compose sets `TRANSCRIBER=stub` so the worker runs without an external MMS container. To point at a real wrapper, set `TRANSCRIBER=mms-http` and `TRANSCRIBER_URL` in the environment.

### Logs and status

```bash
docker compose ps
docker compose logs -f api worker seed
```

The `seed` service runs once, prints `seed.completed` or `seed.skipped`, then exits. Re-running Compose does **not** duplicate the demo asset.

### Stop and reset

```bash
# Stop containers; keep uploaded media + SQLite
docker compose down

# Full reset (delete MinIO + SQLite volumes)
docker compose down -v
```

### Troubleshooting

| Problem | What to try |
|---|---|
| `docker: 'compose' is not a docker command` | Install the [Compose V2 plugin](https://docs.docker.com/compose/install/), or use a Compose-compatible binary that understands `compose.yaml`. |
| API not reachable on `:8787` | Confirm `HOST=0.0.0.0` inside the api container (`docker compose exec api printenv HOST`). |
| MinIO unhealthy / API waiting | Check `MINIO_SECRET_KEY` is at least 8 characters; run `docker compose logs minio`. If `minio/minio` will not pull, keep the default `MINIO_IMAGE` (or set `MINIO_IMAGE=insectai/minio:latest`). |
| Seed failed | Ensure api health is green first; `docker compose logs seed`. Re-run with `docker compose up seed`. |
| Want a clean DB | `docker compose down -v` then `docker compose up --build`. |

### Without Docker

```bash
pnpm install
cp .env.example .env
# Set STORAGE_PROVIDER=local-disk and STORAGE_SIGNING_SECRET in .env
pnpm dev:api      # terminal 1
pnpm dev:worker   # terminal 2 — same DATABASE_URL / storage root
```

## Start here (contributors)

1. Read `docs-internal/scope.md`, then `plan.md` and `ownership.md`.
2. Pick your pair's next issue from GitHub (filter by `team:ab` or `team:ol`).
3. Every change goes through a PR reviewed by the **other** pair.

## Status

Compose stack (`api` + `worker` + MinIO + sample seed) is the supported local Level-2 path. Package names (`@abolkit/*`) are working names (see ADR 0002).
