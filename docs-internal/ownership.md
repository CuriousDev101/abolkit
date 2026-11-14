# Ownership and working agreement

Team **Abol**: pair **ab** and pair **ol**. Within a pair, split tasks by issue and pair-program on hard parts; inside the pair, decide who is "driver" per issue and write it in the issue.

## Who owns what

| Area | Pair | Notes |
|---|---|---|
| Player core: MediaEngine, custom element, controls, keyboard map, settings | **ab** | #18-20, #33 |
| Captions overlay, WebVTT in `core` | **ab** | #15, #21 |
| Sign window | **ab** | #22 |
| Audio description (playback) | **ab** | #23, #31 |
| Transcript panel | **ab** | #34 |
| Offline client (service worker, PWA) | **ab** | #12, #36 |
| Savanna and plain-page integration | **ab** | #6, #41, #42 |
| Accessibility testing, axe/Playwright, conformance report lead | **ab** | #47-49 |
| Provider SDK, API, worker, queue, ffmpeg, STT, translation, TTS | **ol** | #16, #17, #24-28, #30, #32 |
| Review editor | **ol** | #29 |
| Offline pack builder | **ol** | #35 |
| Job card and audio summary | **ol** | #37, #38 (ab reviews a11y) |
| Credentials and verify page | **ol** | #39, #40 |
| Docker Compose, CI, repo foundation | **ol** | #1, #43 |
| Docs site, self-host and privacy docs | **ol** | #44, #46 (ab writes #45) |
| Naming/licence, organiser contact, demo content, co-designer session, pitch, submission | **both** | #2-4, #50, #52, #53 |

Interfaces between pairs (change only by agreement, via PR to `architecture.md`): the **lesson manifest**, the **AD clip manifest**, the **API surface**, and `provider-sdk` interfaces.

## Review rules

- Every PR is reviewed by someone from the **other** pair. This spreads knowledge and catches contract drift.
- Pair **ab** also does an accessibility check on every UI change (keyboard pass at minimum).
- Docs and ADR updates ride in the same PR as the change.
- Reviews should be answered within about an hour on hackathon days. Small PRs, one issue each.

## Git workflow

- `main` always builds and is demoable. No direct pushes after the foundation is in (#1).
- Branch names: `ab/NN-short-name` or `ol/NN-short-name` (NN = issue number).
- PR title starts with the issue number; body has `Closes #NN` and the PR template checklist.
- Squash merge. Delete branch after merge.
- Secrets never enter git. Large media stays small (<10 MB demo clip) or is documented as a download.

## Communication

- Short sync at the start of each block (about 10 minutes): what is done, what blocks, what changed in a contract.
- Blockers go in the issue as a comment with `@` the other pair, then ask in chat.
- Decisions go in an ADR the moment they are made.

## Definition of done (any issue)

1. Meets the issue's acceptance criteria.
2. Reviewed and merged to `main`.
3. Keyboard-only pass for UI; screen-reader spot-check or logged as pending.
4. Docs/ADR/contract updated if needed.
5. Does not make `main` slower to build or break the Docker Compose start.
