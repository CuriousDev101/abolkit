# Contributing (team Abol)

Short version of `docs-internal/ownership.md` and ADR 0004. Read those for the reasons.

## Setup

```bash
pnpm install
pnpm check        # typecheck + lint + format check + build (same as CI)
pnpm format       # fix formatting
```

## Workflow

1. Pick an issue (they are numbered in work order; filter by your team label `team:ab` or `team:ol`).
2. Branch from `main`: `ab/NN-short-name` or `ol/NN-short-name` (NN = issue number).
3. Small commits; keep one issue per PR. Add `Closes #NN` and fill in the PR template.
4. **A member of the other pair reviews every PR.** Pair ab also does an accessibility check on UI changes (keyboard pass at minimum).
5. Squash merge, delete the branch. `main` must always build and stay demoable.
6. Update docs, contracts (`docs-internal/architecture.md`) or ADRs in the same PR when you change them.

## Rules of thumb

- No secrets in git. Use environment variables; commit only `.env.example`.
- No new third-party network calls by default (ADR 0003).
- Real HTML controls, visible focus, labels, `lang` on Amharic text. If `jsx-a11y` complains, fix the markup instead of disabling the rule.
- Keep the demo clip and other media small and rights-cleared (`samples/README.md`).
