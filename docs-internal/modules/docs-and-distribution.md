# Module: docs-and-distribution

- **Owner:** pair ol (site, self-host, privacy), pair ab (component reference) · **Issues:** #43-46, #51, #58 · **Location:** `apps/docs`

## Why it matters

Adoption is worth 25 points: a judge should install the module in about an hour from our docs. Keeping it running is worth 15: the README must be clear and defaults must be cheap.

## Docs site

- **Starlight (Astro)**, chosen for accessibility, light pages and built-in search; the docs site itself must pass axe. Verify current versions when installing.
- **API reference:** OpenAPI from the API, rendered by Scalar at `/docs`.
- **Component reference:** generated from a Custom Elements Manifest where possible (attributes, events, CSS variables) plus the keyboard map.
- **Live demos:** custom elements embed directly in the docs pages (also proves portability).

### First pages to write

1. Quickstart: one script tag and one element, copy-paste.
2. Install at Level 1 / 2 / 3.
3. Component reference (player, job card).
4. Self-host with Docker Compose: clean clone to running, expected output.
5. Providers and privacy: what leaves the machine for each provider, how to enable or disable, retention.
6. Accessibility statement: keyboard map, known limitations, link to the conformance report.
7. Contributing and decisions (links to internal ADRs are fine in the public docs).

## Distribution

- Built `abol-player.js` (and `abol-job-card.js`) served by the API at `/widget/*` and attached to Git releases.
- **CDN:** jsDelivr can serve files from a pinned Git tag; docs examples always pin an exact version, never `latest`. Publishing to npm is optional (#58) and only after naming (#2).
- Size budget enforced by `size-limit` in CI (#51); budget numbers recorded in plan.md.

## Done when

A teammate who did not write the code gets from a clean clone to a running player and API using only the docs; docs site passes axe; every code sample is copy-paste runnable.
