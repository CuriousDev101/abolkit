# Module: docs-and-distribution

- **Owner:** pair ol (site, self-host, privacy), pair ab (component reference) · **Issues:** #43-46, #51, #58 · **Location:** `apps/docs`

## Why it matters

Adoption is worth 25 points: a judge should install the module in about an hour from our docs. Keeping it running is worth 15: the README must be clear and defaults must be cheap.

## Docs site

- **Starlight (Astro)** in `apps/docs` (`@abolkit/docs`). Run `pnpm dev:docs` / `pnpm build:docs`.
- **API reference:** OpenAPI from the API, rendered by Scalar at `/docs`.
- **Component reference:** generated from a Custom Elements Manifest where possible (attributes, events, CSS variables) plus the keyboard map.
- **Live demos:** custom elements embed directly in the docs pages (also proves portability).

### Pages (v0.1.1)

1. Quickstart: one script tag and one element, copy-paste (`/getting-started/`).
2. Install guides pinned to **`@0.1.1`**: overview, CDN, `@abolkit/job-card`, `@abolkit/player`, frameworks (`/install/…`).
3. Component reference (player, job card) — expand beyond install attributes as needed.
4. Self-host with Docker Compose: clean clone to running, expected output.
5. Providers and privacy: what leaves the machine for each provider, how to enable or disable, retention.
6. Accessibility statement: keyboard map, known limitations, link to the conformance report.
7. Contributing and decisions (links to internal ADRs are fine in the public docs).

## Distribution

- Built `abol-player.js` (and `abol-job-card.js`) served by the API at `/widget/*` and attached to Git releases.
- **CDN:** jsDelivr / unpkg; docs examples always pin **`@0.1.1`**, never `latest`.
- Size budget enforced by `size-limit` in CI (#51); budget numbers recorded in plan.md.

## Done when

A teammate who did not write the code gets from a clean clone to a running player and API using only the docs; docs site passes axe; every code sample is copy-paste runnable.
