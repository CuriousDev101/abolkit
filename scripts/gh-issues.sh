#!/usr/bin/env bash
# Creates issues #1..#58 in order. GitHub numbers issues sequentially, so the [NN] in each title
# matches the issue number as long as the repo has no earlier issues or PRs.
# Usage: bash scripts/gh-labels.sh && bash scripts/gh-issues.sh
# Set FORCE=1 to skip the empty-repo check.
set -euo pipefail
REPO="${REPO:-CuriousDev101/abolkit}"

if [ "${FORCE:-0}" != "1" ]; then
  existing="$(gh issue list --repo "$REPO" --state all --limit 1 --json number --jq 'length')"
  prs="$(gh pr list --repo "$REPO" --state all --limit 1 --json number --jq 'length')"
  if [ "$existing" != "0" ] || [ "$prs" != "0" ]; then
    echo "Repo already has issues or PRs: numbering would not match the docs. Use FORCE=1 to continue." >&2
    exit 1
  fi
fi

phase_for() { # number -> phase label
  local n=$1
  if   [ "$n" -le 14 ]; then echo "phase:0-spikes"
  elif [ "$n" -le 28 ]; then echo "phase:1-day1-build"
  elif [ "$n" -le 53 ]; then echo "phase:2-day2-integrate"
  else echo "phase:3-stretch"; fi
}

# issue NUM "title" "team,priority,type,area" "depends on" "doc path"   (body from stdin)
issue() {
  local num=$1 title=$2 labels=$3 deps=$4 doc=$5 body url got
  body="$(cat)"
  body="$body"$'\n\n'"**Depends on:** ${deps}"$'\n'"**Docs:** \`${doc}\`"
  url="$(gh issue create --repo "$REPO" \
    --title "$(printf '[%02d] %s' "$num" "$title")" \
    --label "$labels,$(phase_for "$num")" \
    --body "$body")"
  got="${url##*/}"
  if [ "$got" != "$num" ]; then echo "WARNING: expected #$num but GitHub created #$got ($url)" >&2; else echo "#$num ok"; fi
}

# ============================ PHASE 0: setup and spikes ============================

issue 1 "chore: repo foundation (workspace, tsconfig, lint/format, CI skeleton)" "team:ol,P0-must,type:chore,area:infra" "none" "docs-internal/decisions/0004-workflow.md" <<'EOF'
### Goal
Everyone can clone, install and build with one command; main always builds.

### Acceptance criteria
- [ ] `pnpm install` works from a clean clone
- [ ] Lint + format config (ESLint with `jsx-a11y`, Prettier) and a root `typecheck` script
- [ ] CI workflow: install, typecheck, lint, build (can be minimal)
- [ ] Per-package `tsconfig.json` extending `tsconfig.base.json`
- [ ] Branch rule agreed: short-lived branches, PR, review from the other pair
EOF

issue 2 "chore: naming, licence and npm scope" "team:both,P0-must,type:chore,area:infra" "none" "docs-internal/decisions/0002-naming-and-scope.md" <<'EOF'
### Goal
Settle names and licence before anything is published.

### Acceptance criteria
- [ ] Check availability: GitHub org/repo, npm scope (`@abol` is taken), domain if wanted
- [ ] Pick scope (working name `@abolkit`) and record it in ADR 0002
- [ ] Add an open-source `LICENSE` (site asks for an open licence) and check licences of fonts/models we ship
- [ ] Rename workspace packages if the scope changes
EOF

issue 3 "chore: contact organisers and co-designer (ESL content, rules, credits, Savanna)" "team:both,P0-must,type:chore,area:integration" "none" "docs-internal/scope.md" <<'EOF'
### Goal
Remove unknowns that can block us. Ask in the Telegram group / mentors.

### Questions to get answered (record answers in scope.md)
- [ ] Is pre-written code / scaffolding allowed?
- [ ] Can we get a Deaf co-designer for Track 2 and real Ethiopian Sign Language sample content (or an interpreter contact)?
- [ ] Are cloud credits provided (STT/TTS)? Any self-hosted model guidance from the training?
- [ ] What does "runs inside Savanna" mean concretely beyond the static pages? Is there a real Savanna API?
- [ ] How is judging weighted, and when/how is the co-designer test run?
EOF

issue 4 "chore: choose demo lesson clip and write EN/AM source texts" "team:both,P0-must,type:chore,area:content" "none" "docs-internal/modules/pipeline.md" <<'EOF'
### Goal
One rights-cleared 60-90 s lesson clip that has some visual-only content (slide, diagram) so audio description has a real job.

### Acceptance criteria
- [ ] Clip in `samples/` (small file; note the source and licence in `samples/README.md`)
- [ ] English transcript and Amharic transcript reviewed by an Amharic speaker
- [ ] Draft audio-description cues (EN + AM) for the visual-only parts
- [ ] A short job posting sample (for the job card) and a sample certificate
EOF

issue 5 "spike: player engine - Video.js vs native vs Media Chrome" "team:ab,P0-must,type:spike,area:player" "none" "docs-internal/decisions/0001-player-engine.md" <<'EOF'
### Goal
Back ADR 0001 with numbers. Decision so far: Video.js, with native `<video>` as fallback.

### Measure and record in `spikes/05-player-engine/RESULT.md`
- [ ] Built size (gzipped) and request count for each option; Slow 3G load time
- [ ] Works inside a Shadow DOM: fullscreen, menus, focus, keyboard
- [ ] Keyboard-only and NVDA/TalkBack results
- [ ] Can we style captions freely and sync a second video?
- [ ] Confirm or trigger the exit rules in ADR 0001
EOF

issue 6 "spike: Savanna host baseline (serve pages, axe, insertion point)" "team:ab,P0-must,type:spike,area:integration" "none" "docs-internal/modules/host-integration.md" <<'EOF'
### Goal
Know exactly what the host pages do before we embed into them.

### Acceptance criteria
- [ ] Pages served over http; `static-page.js` read; global CSS risks listed
- [ ] axe run on all three pages; baseline saved to `docs-internal/conformance/host-baseline.md`
- [ ] Insertion point chosen on `concept-with-navigation.html`
- [ ] Sandbox "hello" element works via one script tag (classic IIFE, Shadow DOM)
EOF

issue 7 "spike: speech-to-text on Amharic and English (faster-whisper vs AssemblyAI vs MMS)" "team:ol,P0-must,type:spike,area:pipeline" "#4" "docs-internal/decisions/0003-providers-and-privacy.md" <<'EOF'
### Goal
Choose the default transcriber with evidence. Speed is secondary because jobs run in the background and demo results are pre-computed.

### Acceptance criteria
- [ ] Same clip through each engine; an Amharic speaker marks errors
- [ ] Record: accuracy, time, model size, hardware, cost, whether audio leaves the host, current language support
- [ ] Recommendation written in `spikes/07-stt/RESULT.md`; update ADR 0003 default
EOF

issue 8 "spike: Amharic text-to-speech on a low-end Android phone and alternatives" "team:ol,P0-must,type:spike,area:pipeline" "#4" "docs-internal/modules/audio-description.md" <<'EOF'
### Goal
Find out what actually produces Amharic voice for audio description and audio summaries.

### Acceptance criteria
- [ ] Test browser `speechSynthesis` on a cheap Android phone
- [ ] Test self-hosted option (e.g. MMS-TTS) and one cloud option, and a human recording
- [ ] Record quality, latency, licence, data leaving the host
- [ ] Decide: recorded clips vs generated clips vs text-only fallback
EOF

issue 9 "spike: ffmpeg recipes (audio extract, Opus 24 kbps, 240p, AD mix with ducking)" "team:ol,P0-must,type:spike,area:pipeline" "none" "docs-internal/modules/pipeline.md" <<'EOF'
### Acceptance criteria
- [ ] Commands that extract 16 kHz mono audio, make 24 kbps Opus audio and a 240p video
- [ ] Mix timed AD clips onto the main audio with ducking
- [ ] Works inside the worker Docker image; recipes saved in `spikes/09-ffmpeg/`
EOF

issue 10 "spike: Hono + zod-openapi + Scalar docs" "team:ol,P0-must,type:spike,area:api" "none" "docs-internal/architecture.md" <<'EOF'
### Acceptance criteria
- [ ] One route with Zod schemas generates `/openapi.json`
- [ ] Docs page (Scalar) served at `/docs`
- [ ] A typed client can be generated from the spec
- [ ] CORS and script-tag-embed calls work from a page on another origin
EOF

issue 11 "spike: storage, queue and database defaults" "team:ol,P1-should,type:spike,area:infra" "none" "docs-internal/decisions/0005-storage-queue-db-defaults.md" <<'EOF'
### Goal
Fewest moving parts a judge can run. Decide defaults.

### Acceptance criteria
- [ ] Local-disk and MinIO both work behind the `Storage` interface (signed URL, expiry)
- [ ] In-process/DB-backed queue vs Redis+BullMQ compared (retry, progress, separate worker)
- [ ] SQLite vs Postgres choice for the demo
- [ ] ADR 0005 updated to Accepted
EOF

issue 12 "spike: offline - service worker, Cache API, IndexedDB on throttled 3G and a real phone" "team:ab,P0-must,type:spike,area:offline" "none" "docs-internal/modules/offline-pack.md" <<'EOF'
### Acceptance criteria
- [ ] Install, go offline, lesson audio + transcript still work
- [ ] Measure total offline pack size and load time on Slow 3G
- [ ] Test on one low-end Android phone
EOF

issue 13 "spike: Ethiopic rendering, lang attributes and Ethiopian calendar" "team:ab,P1-should,type:spike,area:player" "none" "docs-internal/conformance/test-protocol.md" <<'EOF'
### Acceptance criteria
- [ ] Noto Sans Ethiopic loads inside the Shadow DOM; fallback on a phone with no Ethiopic font
- [ ] `lang="am"` makes NVDA/TalkBack read Amharic correctly
- [ ] `Intl.DateTimeFormat` with the Ethiopic calendar output checked
- [ ] Caption line breaking at large sizes checked
EOF

issue 14 "spike: Open Badges 3.0 signing/verification and JobPosting JSON-LD" "team:ol,P1-should,type:spike,area:credentials" "none" "docs-internal/modules/credentials.md" <<'EOF'
### Acceptance criteria
- [ ] Issue one signed credential and verify it
- [ ] JobPosting JSON-LD validates in a structured-data validator
- [ ] Key storage approach decided (no private keys in the repo)
EOF

# ============================ PHASE 1: day 1 core build ============================

issue 15 "feat(core): WebVTT parse/serialize with unit tests" "team:ab,P0-must,type:feature,area:captions" "none" "docs-internal/modules/captions.md" <<'EOF'
### Acceptance criteria
- [ ] `parseVtt` / `serializeVtt` in `@abolkit/core`, round-trips cleanly
- [ ] Handles Ethiopic text, multi-line cues, cue settings ignored safely
- [ ] Unit tests including malformed input
EOF

issue 16 "feat(provider-sdk): adapter interfaces and default adapter skeletons" "team:ol,P0-must,type:feature,area:pipeline" "#7,#8" "docs-internal/decisions/0003-providers-and-privacy.md" <<'EOF'
### Acceptance criteria
- [ ] Interfaces reviewed by pair ab (they already exist as a first draft)
- [ ] Config selects providers by name; defaults need no accounts or network
- [ ] Adapters report `sendsDataOffHost`; consent flag required before use
EOF

issue 17 "feat(api): Hono skeleton, config, health, zod-openapi spec, docs page" "team:ol,P0-must,type:feature,area:api" "#10" "docs-internal/architecture.md" <<'EOF'
### Acceptance criteria
- [ ] `GET /api/health`, `GET /openapi.json`, `/docs`
- [ ] CORS configured; errors are consistent JSON
- [ ] Runs with one command in dev
EOF

issue 18 "feat(player): MediaEngine interface and Video.js adapter (native fallback plan)" "team:ab,P0-must,type:feature,area:player" "#5" "docs-internal/modules/player.md" <<'EOF'
### Acceptance criteria
- [ ] Adapter implements `MediaEngine`; UI never imports Video.js directly
- [ ] Player code lazy-loaded
- [ ] Native adapter skeleton kept compiling so a swap costs hours, not days
EOF

issue 19 "feat(player): <abol-player> custom element, Shadow DOM, IIFE build, attributes/events" "team:ab,P0-must,type:feature,area:player" "#6,#18" "docs-internal/modules/player.md" <<'EOF'
### Acceptance criteria
- [ ] One script tag + `<abol-player manifest="...">` works on a plain page and on the Savanna copy
- [ ] Attributes, events and CSS variables match the contract in player.md
- [ ] No host CSS leaks in or out; focus and screen reader reading work inside the shadow root
EOF

issue 20 "feat(player): accessible controls and keyboard map" "team:ab,P0-must,type:feature,area:player" "#19" "docs-internal/modules/player.md" <<'EOF'
### Acceptance criteria
- [ ] Real buttons/sliders with names, states and visible focus; 44px targets
- [ ] Single-key shortcuts only active when the player has focus, and can be switched off (WCAG 2.1.4)
- [ ] Audio that plays can be paused; no autoplay (WCAG 1.4.2)
- [ ] Keyboard-only and screen-reader pass recorded
EOF

issue 21 "feat(captions): custom overlay (EN/AM) with size, colour, background, position; persisted" "team:ab,P0-must,type:feature,area:captions" "#15,#19" "docs-internal/modules/captions.md" <<'EOF'
### Acceptance criteria
- [ ] Two caption tracks with a language switch
- [ ] Size, text colour, background colour/opacity, position; remembered per viewer
- [ ] Meets 4.5:1 contrast by default; readable at 200% zoom
- [ ] Ethiopic text renders correctly
EOF

issue 22 "feat(sign-window): floating synced video, drag/resize by pointer AND keyboard, dock" "team:ab,P0-must,type:feature,area:sign-window" "#19" "docs-internal/modules/sign-window.md" <<'EOF'
### Acceptance criteria
- [ ] Window shows any second video; main video is the clock, drift corrected on pause/seek/buffering
- [ ] Move and resize with a single pointer and with keyboard (WCAG 2.5.7), plus dock-to-corner button
- [ ] Position/size remembered; never covers the controls by default
- [ ] Works with placeholder content; real signed content swapped in when available (#3)
EOF

issue 23 "feat(audio-description): text mode via descriptions track and aria-live" "team:ab,P0-must,type:feature,area:audio-description" "#15,#19" "docs-internal/modules/audio-description.md" <<'EOF'
### Acceptance criteria
- [ ] `descriptions` WebVTT loaded; cues announced through a polite live region
- [ ] Toggle with `aria-pressed`, remembered preference
- [ ] Appears in the transcript
EOF

issue 24 "feat(api): asset upload and storage adapter (local disk default)" "team:ol,P0-must,type:feature,area:api" "#16,#17" "docs-internal/architecture.md" <<'EOF'
### Acceptance criteria
- [ ] `POST /api/assets` (multipart), `GET /api/assets/:id`
- [ ] Size/type limits; signed URLs with expiry; retention setting
- [ ] Storage chosen by config
EOF

issue 25 "feat(worker): job queue and job status endpoint" "team:ol,P0-must,type:feature,area:pipeline" "#11,#17" "docs-internal/modules/pipeline.md" <<'EOF'
### Acceptance criteria
- [ ] Jobs have id, type, status, progress, error
- [ ] Retry on failure; worker runs separately from the API
- [ ] `POST /api/assets/:id/jobs`, `GET /api/jobs/:id`
EOF

issue 26 "feat(worker): ffmpeg audio extraction and renditions (Opus audio, 240p)" "team:ol,P0-must,type:feature,area:pipeline" "#9,#25" "docs-internal/modules/pipeline.md" <<'EOF'
### Acceptance criteria
- [ ] 16 kHz mono extraction for STT; 24 kbps Opus audio; 240p video
- [ ] Output sizes logged for the offline-pack report
EOF

issue 27 "feat(worker): transcription via provider adapter (self-hosted default)" "team:ol,P0-must,type:feature,area:pipeline" "#7,#16,#26" "docs-internal/modules/pipeline.md" <<'EOF'
### Acceptance criteria
- [ ] Output cues marked `needsReview`
- [ ] Optional cloud adapter off by default, consent required
- [ ] Pre-computed demo result committed under `samples/`
EOF

issue 28 "feat(api): lesson manifest, cue CRUD and WebVTT export" "team:ol,P0-must,type:feature,area:api" "#15,#24,#27" "docs-internal/architecture.md" <<'EOF'
### Acceptance criteria
- [ ] `GET /api/lessons/:id` returns the manifest the player consumes
- [ ] Get/put captions and descriptions per language; `.vtt` export
- [ ] Manifest shape documented and shared with pair ab
EOF

# ============================ PHASE 2: day 2 integrate and polish ============================

issue 29 "feat(review-editor): edit cues and timing, preview in the player, save" "team:ol,P0-must,type:feature,area:review-editor" "#19,#28" "docs-internal/modules/review-editor.md" <<'EOF'
### Acceptance criteria
- [ ] Table of cues, edit text and timing, jump-to-time preview
- [ ] Machine-generated cues highlighted until a human marks them reviewed
- [ ] The editor itself is keyboard- and screen-reader-usable
EOF

issue 30 "feat(worker): translation EN<->AM adapter with review flag" "team:ol,P1-should,type:feature,area:pipeline" "#16,#27" "docs-internal/modules/pipeline.md" <<'EOF'
### Acceptance criteria
- [ ] Self-hosted default adapter (or 'none'); cloud adapter optional
- [ ] Output flagged `needsReview`; never presented as final
EOF

issue 31 "feat(audio-description): voice mode, ducking and extended pauses" "team:ab,P1-should,type:feature,area:audio-description" "#23,#32" "docs-internal/modules/audio-description.md" <<'EOF'
### Acceptance criteria
- [ ] Per-cue audio clip plays at cue time; main audio ducked then restored
- [ ] `pauseVideo` flag pauses the video until the clip ends
- [ ] Starts only after a user gesture
EOF

issue 32 "feat(worker): AD clips, manifest with pauseVideo flags, audio-only AD mix" "team:ol,P1-should,type:feature,area:pipeline" "#8,#9,#28" "docs-internal/modules/audio-description.md" <<'EOF'
### Acceptance criteria
- [ ] One clip per cue (recorded or generated) with duration
- [ ] Manifest `[{id,start,end,text,audio,pauseVideo}]`
- [ ] ffmpeg mix for the offline audio-only version
EOF

issue 33 "feat(player): settings panel, persistence, reduced motion, sound-off friendliness" "team:ab,P1-should,type:feature,area:player" "#20,#21" "docs-internal/modules/player.md" <<'EOF'
### Acceptance criteria
- [ ] Settings in one accessible panel; stored locally, try/catch around storage
- [ ] Honors `prefers-reduced-motion`; everything needed is visible with sound off
EOF

issue 34 "feat(player): transcript panel synced with playback" "team:ab,P1-should,type:feature,area:player" "#15,#21,#23" "docs-internal/modules/player.md" <<'EOF'
### Acceptance criteria
- [ ] Transcript includes captions and descriptions; current cue highlighted; click/Enter seeks
- [ ] Downloadable as plain text/HTML
EOF

issue 35 "feat(offline): offline pack builder with size report" "team:ol,P0-must,type:feature,area:offline" "#26,#28" "docs-internal/modules/offline-pack.md" <<'EOF'
### Acceptance criteria
- [ ] Zip with Opus audio, transcript HTML (no JavaScript needed), captions, `index.html`
- [ ] Size reported in the job result and in docs
- [ ] Opens and plays from a phone file manager
EOF

issue 36 "feat(offline): service worker and 'download for offline' in the player" "team:ab,P1-should,type:feature,area:offline" "#12,#19,#35" "docs-internal/modules/offline-pack.md" <<'EOF'
### Acceptance criteria
- [ ] Cache API + IndexedDB per spike; clear download state and a remove button
- [ ] Works after going offline on Slow 3G
EOF

issue 37 "feat(job-card): <abol-job-card> with JobPosting JSON-LD, responsive, 200% zoom" "team:ol,P0-must,type:feature,area:job-card" "#14" "docs-internal/modules/job-card.md" <<'EOF'
### Acceptance criteria
- [ ] Custom element + JSON-LD; no horizontal scroll at 200% zoom
- [ ] Plain-language text, semantic markup; reviewed by pair ab for accessibility
EOF

issue 38 "feat(job-card): audio summary (pre-generated clip with fallback)" "team:ol,P1-should,type:feature,area:job-card" "#8,#37" "docs-internal/modules/job-card.md" <<'EOF'
### Acceptance criteria
- [ ] Play/pause audio summary button; text always available
- [ ] Falls back gracefully if audio is missing
EOF

issue 39 "feat(credentials): Open Badges 3.0 issue endpoint and key management" "team:ol,P0-must,type:feature,area:credentials" "#14,#17" "docs-internal/modules/credentials.md" <<'EOF'
### Acceptance criteria
- [ ] `POST /api/credentials` returns a signed credential and a share link
- [ ] Keys from environment/secret store, never committed
EOF

issue 40 "feat(credentials): public accessible verify page" "team:ol,P0-must,type:feature,area:credentials" "#39" "docs-internal/modules/credentials.md" <<'EOF'
### Acceptance criteria
- [ ] `/verify/:id` shows valid/invalid, issuer, recipient, date in plain language
- [ ] Passes axe; usable by keyboard, at 200% zoom
EOF

issue 41 "feat(host): Savanna integration via script tag, fix conflicts" "team:ab,P0-must,type:feature,area:integration" "#6,#19,#28" "docs-internal/modules/host-integration.md" <<'EOF'
### Acceptance criteria
- [ ] Player and job card embedded in copies of the Savanna pages (original repo untouched)
- [ ] No axe regressions vs the host baseline
- [ ] Works from `http://localhost`; classic script also loads from `file://`
EOF

issue 42 "feat(host): plain 'other site' demo page proving portability" "team:ab,P1-should,type:feature,area:integration" "#19" "docs-internal/modules/host-integration.md" <<'EOF'
### Acceptance criteria
- [ ] Separate origin, one script tag + element, no framework
- [ ] Used in the pitch and in the docs
EOF

issue 43 "chore(docker): docker compose up from a clean clone" "team:ol,P0-must,type:chore,area:infra" "#17,#24,#25" "docs-internal/architecture.md" <<'EOF'
### Acceptance criteria
- [ ] API, worker and storage start with one command; sample data loads
- [ ] A team member tries it from a fresh clone and follows only the README
EOF

issue 44 "docs: Starlight scaffold, quickstart and script-tag install" "team:ol,P0-must,type:docs,area:docs" "#19" "docs-internal/modules/docs-and-distribution.md" <<'EOF'
### Acceptance criteria
- [ ] Starlight site in `apps/docs`; passes axe
- [ ] Quickstart: copy-paste script tag + element with live demo
EOF

issue 45 "docs: component reference (attributes, events, CSS variables, keyboard map)" "team:ab,P1-should,type:docs,area:docs" "#19,#20,#44" "docs-internal/modules/docs-and-distribution.md" <<'EOF'
### Acceptance criteria
- [ ] Generated from a Custom Elements Manifest where possible; keyboard map included
EOF

issue 46 "docs: self-host guide and privacy/providers page" "team:ol,P0-must,type:docs,area:docs" "#43,#16" "docs-internal/modules/docs-and-distribution.md" <<'EOF'
### Acceptance criteria
- [ ] Clean clone to running with expected output
- [ ] What leaves the machine for each provider; how to enable/disable; retention
EOF

issue 47 "test: axe-core and Playwright accessibility checks in CI" "team:ab,P0-must,type:test,area:a11y" "#1,#41" "docs-internal/conformance/test-protocol.md" <<'EOF'
### Acceptance criteria
- [ ] axe runs against player, job card, verify page, docs site
- [ ] Zero critical/serious violations; CI fails on regressions
EOF

issue 48 "test: manual protocol runs (NVDA, TalkBack, keyboard-only, 200/400% zoom, sound-off, 3G, low-end phone)" "team:ab,P0-must,type:test,area:a11y" "#41" "docs-internal/conformance/test-protocol.md" <<'EOF'
### Acceptance criteria
- [ ] Each protocol run logged with date, tester, result, defects filed
EOF

issue 49 "docs: WCAG 2.2 AA conformance report" "team:both,P0-must,type:test,area:a11y" "#47,#48" "docs-internal/conformance/wcag-2.2-aa-checklist.md" <<'EOF'
### Acceptance criteria
- [ ] Every relevant criterion marked pass / fail / n/a with evidence; known issues listed honestly
- [ ] Exported for the submission
EOF

issue 50 "test: co-designer session (prepare tasks, observe, log, fix)" "team:both,P0-must,type:test,area:a11y" "#41" "docs-internal/conformance/co-designer-log.md" <<'EOF'
### Acceptance criteria
- [ ] Task script prepared; main task completed unaided with screen reader / keyboard / 200% zoom / sound off
- [ ] Findings logged and the top fixes done before submission
EOF

issue 51 "chore: bundle-size budget with size-limit and report" "team:ab,P1-should,type:chore,area:infra" "#19" "docs-internal/plan.md" <<'EOF'
### Acceptance criteria
- [ ] Budget numbers recorded in plan.md; CI fails when exceeded; report included in the pitch
EOF

issue 52 "chore: pitch, demo script and three rehearsals" "team:both,P0-must,type:chore,area:docs" "#41,#49" "docs-internal/plan.md" <<'EOF'
### Acceptance criteria
- [ ] 3-4 minute script (embed, keyboard, Amharic captions, sign window, pipeline, 3G pack, job card, OpenAPI)
- [ ] Honest about placeholders and provider choices; backup recording in case live demo fails
EOF

issue 53 "chore: submission packaging (code, README, compose, conformance report) and final checks" "team:both,P0-must,type:chore,area:infra" "#43,#46,#49" "docs-internal/plan.md" <<'EOF'
### Acceptance criteria
- [ ] Deadline and format re-checked on the site; repo public with licence
- [ ] Fresh-clone test passes; nothing secret in git history
EOF

# ============================ PHASE 3: stretch ============================

issue 54 "stretch: tagged HTML/PDF with image descriptions" "team:ol,P2-stretch,type:stretch,area:pipeline" "#35" "docs-internal/modules/pipeline.md" <<'EOF'
Accessible HTML first; try Chromium print-to-PDF and check with a PDF accessibility checker. Timebox 90 minutes.
EOF

issue 55 "stretch: Braille export (.brf)" "team:ol,P2-stretch,type:stretch,area:pipeline" "#28" "docs-internal/scope.md" <<'EOF'
Only if tables for the needed script are available and someone can verify the output.
EOF

issue 56 "stretch: recorded-session viewer with captions and chat log" "team:ab,P2-stretch,type:stretch,area:player" "#21,#34" "docs-internal/scope.md" <<'EOF'
Viewer for a recorded live session with captions and chat log.
EOF

issue 57 "stretch: Afaan Oromo / Tigrinya / Afar transcript feasibility" "team:ol,P2-stretch,type:stretch,area:pipeline" "#7" "docs-internal/modules/pipeline.md" <<'EOF'
Check current language support of each engine; document what is and is not possible. Do not promise beyond English and Amharic.
EOF

issue 58 "stretch: npm + CDN distribution with a dummy package" "team:both,P2-stretch,type:stretch,area:docs" "#2,#19" "docs-internal/modules/docs-and-distribution.md" <<'EOF'
Publish or `npm pack` a tiny package and load it on another origin via a CDN URL, with pinned versions.
EOF

echo "Done. Created 58 issues in $REPO"
