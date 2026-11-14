# 0004: Repo structure and team workflow

- **Status:** Proposed
- **Date:** 2026-11-14
- **Deciders:** both pairs

## Decision (proposed)

- pnpm workspace monorepo: `packages/*`, `services/*`, `apps/*`. TypeScript everywhere, shared `tsconfig.base.json`.
- Two pairs, ownership in `ownership.md`; every PR reviewed by the other pair; pair ab does an accessibility check on UI changes.
- `main` always builds and is demoable; short-lived branches `ab/NN-name`, `ol/NN-name`; squash merge; `Closes #NN`.
- Issues are numbered in work order (`[NN]` in the title) and labelled by team, priority, phase, type and area (`scripts/gh-labels.sh`, `scripts/gh-issues.sh`).
- ESLint with `jsx-a11y`, Prettier, axe + Playwright in CI (#1, #47).
- The cloned `Savanna-static-pages` repo is never edited; generated test copies are git-ignored (`**/_abol-test-*.html`).
- ADRs for hard-to-reverse choices; docs updated in the same PR.

## Consequences

Small overhead per PR, large benefit in contract discipline between the pairs. If review latency blocks work on day 2, allow self-merge for docs-only and test-only PRs, and say so in the channel.
