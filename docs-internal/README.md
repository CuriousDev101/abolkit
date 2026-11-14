# Internal docs index

These documents are for the team. They record what we build, why, who owns it and how we know it works. Keep them short, current and honest. If code and docs disagree, fix one of them the same day.

| Document | Read it for |
|---|---|
| [scope.md](scope.md) | What Track 2 requires, scoring, gate, what is in and out |
| [architecture.md](architecture.md) | Components, data contracts, API surface, privacy and performance rules |
| [ownership.md](ownership.md) | Who owns what, review rules, working agreement |
| [plan.md](plan.md) | Phases, timeline, critical path, cut line, risks |
| [modules/](modules/) | One file per module: contract, design, done-definition, tests |
| [conformance/](conformance/) | WCAG 2.2 AA checklist, test protocol, co-designer log |
| [decisions/](decisions/) | Architecture decision records (ADRs) |

## Modules

[player](modules/player.md) · [captions](modules/captions.md) · [sign-window](modules/sign-window.md) · [audio-description](modules/audio-description.md) · [pipeline](modules/pipeline.md) · [review-editor](modules/review-editor.md) · [offline-pack](modules/offline-pack.md) · [job-card](modules/job-card.md) · [credentials](modules/credentials.md) · [host-integration](modules/host-integration.md) · [docs-and-distribution](modules/docs-and-distribution.md)

## Conventions

- Issues are numbered in work order and referenced as `#NN` in docs and code comments.
- Status words in ADRs: **Proposed** (not yet agreed), **Accepted**, **Superseded**.
- Facts about the hackathon come from https://digitalbridge.et/ and the Telegram group; re-check them before relying on dates, times or rules.
