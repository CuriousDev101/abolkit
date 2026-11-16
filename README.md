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

## Local development (Docker) — ADR 0007 captions

Default Compose ([`docker-compose.yml`](docker-compose.yml)) starts **Postgres**, **Redis**, **MinIO**, the **API**, and the **worker** for URL caption generation (YouTube VTT when available, else AssemblyAI → Gemini).

### Prerequisites

- Docker Engine with **Compose V2** (`docker compose version`)
- A `.env` file (copy from `.env.example`) with secrets and `ASSEMBLYAI_API_KEY` / `GEMINI_API_KEY`
- Ports free on localhost: `8787` (API), `5432`, `6379`, `9000`/`9001` (MinIO)

### Quick start (local — default)

```bash
git clone https://github.com/CuriousDev101/abolkit.git
cd abolkit
cp .env.example .env
# Edit .env: API_KEY, POSTGRES_PASSWORD, MINIO_SECRET_KEY, ASSEMBLYAI_API_KEY, GEMINI_API_KEY
docker compose up --build
```

Uses [`Dockerfile.dev`](Dockerfile.dev) + source bind mounts (`--watch`).

### Production / EC2

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Uses [`Dockerfile`](Dockerfile): prod deps only, source baked into the image.

| | Local (default) | Production |
|---|---|---|
| Command | `docker compose up --build` | `docker compose -f docker-compose.prod.yml up -d --build` |
| Dockerfile | `Dockerfile.dev` | `Dockerfile` |
| Process | `node --watch …` | `node …` (no watch) |
| Source | bind-mounted | copied into the image |

There are **no weak password defaults in Compose** — missing secrets fail fast. Change every `change-me` value before sharing the host.

Legacy SQLite + seed stack (ADR 0005): `docker compose -f compose.sqlite.yaml up --build`

### Access

| What | URL |
|---|---|
| API health | http://127.0.0.1:8787/api/health |
| OpenAPI docs (Scalar) | http://127.0.0.1:8787/docs |
| OpenAPI JSON | http://127.0.0.1:8787/openapi.json |
| MinIO console | http://127.0.0.1:9001 |

Write routes (assets/jobs): header `X-API-Key` matching `API_KEY` in `.env`.  
Caption generate/status routes stay public for the embeddable player (rate limited).

API is bound to **127.0.0.1** only — put Caddy/Nginx on the host for public HTTPS.

### Logs and status

```bash
docker compose ps
docker compose logs -f api worker
```

### Stop and reset

```bash
docker compose down          # keep volumes
docker compose down -v       # wipe Postgres / Redis / MinIO data
```

### Troubleshooting

| Problem | What to try |
|---|---|
| `docker: 'compose' is not a docker command` | Install the [Compose V2 plugin](https://docs.docker.com/compose/install/). |
| Compose errors about unset `API_KEY` / passwords | Copy `.env.example` → `.env` and fill required values. |
| API not on `:8787` | Confirm publish is `127.0.0.1:8787` (`docker compose ps`). |
| MinIO unhealthy | `MINIO_SECRET_KEY` must be ≥8 characters; `docker compose logs minio`. |
| Worker `BAD_CONFIG` | Set `ASSEMBLYAI_API_KEY` and `GEMINI_API_KEY` in `.env`, recreate worker. |

### Without Docker

```bash
pnpm install
cp .env.example .env
# Set STORAGE_PROVIDER=local-disk and STORAGE_SIGNING_SECRET in .env
pnpm dev:api      # terminal 1
pnpm dev:worker   # terminal 2
```

## Start here (contributors)

1. Read `docs-internal/scope.md`, then `plan.md` and `ownership.md`.
2. Pick your pair's next issue from GitHub (filter by `team:ab` or `team:ol`).
3. Every change goes through a PR reviewed by the **other** pair.

## Status

Default Compose path is URL captions (Postgres + Redis + MinIO + api + worker). Package names (`@abolkit/*`) are working names (see ADR 0002).
