# Spike 10: Hono + zod-openapi + Scalar

- **Issue:** #10 · **Owner:** pair ol · **Date:** 2026-11-14 · **Timebox:** hackathon day 1

## Question

Can one Zod route on Hono produce `/openapi.json`, a Scalar page at `/docs`, a typed client, and a script-tag call from another origin — without pulling speech-to-text into this process?

## Method

- API in `services/api` (Node 24.17.0): `hono@4.13.18`, `@hono/zod-openapi@1.6.3`, `zod@4.6.7`, `@scalar/hono-api-reference@0.12.20`, `@hono/node-server@2.1.8`.
- One route: `GET /api/health`. The spec says this process does not run speech-to-text. The worker still calls the external MMS wrapper (`TRANSCRIBER_URL`).
- Scalar UI is the package's own UMD file (`@scalar/api-reference@1.78.1`, served at `/docs/scalar.js`). `withDefaultFonts: false` and `proxyUrl: ''` so the page does not call jsDelivr, fonts.scalar.com, or proxy.scalar.com.
- Client: `openapi-typescript@7.13.0` writes `services/api/scripts/schema.d.ts`; `openapi-fetch@0.17.0` calls `GET /api/health`.
- CORS `*` on reads. `spikes/10-zod-openapi/host.html` is served on a second origin and loads `/widget/embed.js`.
- `pnpm-workspace.yaml` sets `allowBuilds.vue-demi: false`. That postinstall only switches Vue 2/3. This API serves the prebuilt Scalar file and does not import the Vue components.

```bash
pnpm --filter @abolkit/api spike:smoke
pnpm --filter @abolkit/api dev
```

## Results

| Check | Measurement | Notes |
|---|---|---|
| `GET /openapi.json` | OpenAPI 3.1.0, one path `/api/health`, spec ~1 KB | Zod schema `Health` |
| `GET /docs` | Scalar page, title "Abol Kit API" | Browser loaded only `/docs/scalar.js` (5,000,073 bytes) and `/openapi.json` |
| Typed client | `fetchHealth()` returned `{ ok: true, service: "abolkit-api" }` | `tsc -p services/api/tsconfig.client.json` |
| Other origin | Page on `:8790` loaded the script from `:8787` | Status text "Abol Kit API is up"; health body matched; `Access-Control-Allow-Origin: *` |
| Try-it on `/docs` | Request URL `http://127.0.0.1:8787/api/health` | Did not go through proxy.scalar.com |
| STT | Not called | No transcribe path in the spec |

## Pass criteria met?

- [x] One route with Zod schemas generates `/openapi.json`
- [x] Docs page (Scalar) served at `/docs`
- [x] A typed client can be generated from the spec
- [x] CORS and script-tag-embed calls work from a page on another origin

## Decision

**Keep Hono + `@hono/zod-openapi` + Scalar.**

- Serve the Scalar script from this API. Do not use the jsDelivr default.
- Leave speech-to-text on the worker's external MMS service. This API does not proxy audio and its health check does not call that service.
- Read routes stay open for embeds. Write routes (#17) are not mounted yet and will need an API key.

## Follow-ups

- `#17`: add the rest of the routes on this app (assets, jobs, lessons, credentials).
- `#27`: worker job calls `createTranscriber({ transcriber: 'mms-http' })`. Do not add that route here.
- `#46`: replace `/widget/embed.js` with the built `abol-player.js`.
