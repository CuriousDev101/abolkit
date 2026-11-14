# 0002: Naming, npm scope and licence

- **Status:** Proposed
- **Date:** 2026-11-14
- **Deciders:** both pairs

## Context

Team name is **Abol** (the first cup of the Ethiopian coffee ceremony). The GitHub repo is `CuriousDev101/abolkit`. The npm scope `@abol` is already taken. The hackathon asks for an open licence and judges installation and adoption, so names should be consistent and easy to type and hear in a screen reader.

## Decision (proposed)

- Product/repo: **Abol Kit** (`abolkit`).
- Working npm scope: **`@abolkit`** (packages `@abolkit/player`, `@abolkit/job-card`, `@abolkit/core`, `@abolkit/provider-sdk`). Verify availability by creating the org or checking the registry; fall back to `@abol-access`.
- Custom elements: `<abol-player>`, `<abol-job-card>` (prefix independent of the npm scope).
- Licence: an OSI-approved permissive licence (MIT or Apache-2.0; Apache-2.0 adds an explicit patent grant). Pick one in #2 and add `LICENSE`.
- Do not publish to npm during the hackathon unless #58 is reached; distribution is a built file plus docs, and optionally jsDelivr from a pinned Git tag.

## Consequences

- If the scope changes, only each `package.json` name and import specifiers change.
- Naming of ceremony-themed parts (Jebena, Sini, Baraka) is optional pitch language, not package names.
- Check licences of Noto Sans Ethiopic, models, the demo clip and any sample content before release.
