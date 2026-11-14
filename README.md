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

## Start here

1. Read `docs-internal/scope.md`, then `plan.md` and `ownership.md`.
2. Pick your pair's next issue from GitHub (issues are numbered in work order; filter by `team:ab` or `team:ol`).
3. Every change goes through a PR reviewed by the **other** pair.

## Status

Blueprint and scaffolding stage. Nothing is published yet. Package names (`@abolkit/*`) are working names (see ADR 0002).
