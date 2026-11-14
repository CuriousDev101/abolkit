#!/usr/bin/env bash
# Creates (or updates) the labels used by the issue script.
# Usage: bash scripts/gh-labels.sh        (needs `gh` installed and logged in)
set -euo pipefail
REPO="${REPO:-CuriousDev101/abolkit}"

label() { # name color description
  gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force
}

# team (who owns it)
label "team:ab"   "1d76db" "Pair ab: player experience, offline client, integration, a11y QA"
label "team:ol"   "0e8a16" "Pair ol: API, worker, review editor, job card, credentials, docs site"
label "team:both" "5319e7" "Needs both pairs"

# priority
label "P0-must"    "b60205" "Required for the demo / gate"
label "P1-should"  "d93f0b" "Important, cut only if time runs out"
label "P2-stretch" "fbca04" "Only after all P0 and P1 are done"

# phase (order of work)
label "phase:0-spikes"        "c5def5" "Setup and timeboxed spikes"
label "phase:1-day1-build"    "bfd4f2" "Core build, hackathon day 1"
label "phase:2-day2-integrate" "d4c5f9" "Integration, polish, testing, submission"
label "phase:3-stretch"       "e4e669" "Stretch goals"

# type
label "type:spike"   "ededed" "Timeboxed experiment with a written result"
label "type:feature" "a2eeef" "New capability"
label "type:chore"   "ededed" "Setup, tooling, process"
label "type:docs"    "0075ca" "Documentation"
label "type:test"    "c2e0c6" "Testing and conformance"
label "type:stretch" "fef2c0" "Stretch goal"

# area
label "area:player"            "f9d0c4" "Video player and controls"
label "area:captions"          "f9d0c4" "Caption overlay and WebVTT"
label "area:sign-window"       "f9d0c4" "Ethiopian Sign Language window"
label "area:audio-description" "f9d0c4" "Audio description"
label "area:pipeline"          "bfdadc" "Worker, ffmpeg, STT, translation, TTS"
label "area:api"               "bfdadc" "REST API and OpenAPI"
label "area:review-editor"     "bfdadc" "Caption/description review UI"
label "area:offline"           "fad8c7" "Offline pack and PWA"
label "area:job-card"          "d4c5f9" "Career gateway: job card"
label "area:credentials"       "d4c5f9" "Open Badges and verify page"
label "area:docs"              "0075ca" "Docs site and guides"
label "area:integration"       "e99695" "Savanna and other-site embedding"
label "area:a11y"              "000000" "Accessibility testing and conformance"
label "area:infra"             "ededed" "Repo, CI, Docker, naming, licence"
label "area:content"           "fef2c0" "Demo clip, scripts, translations"

echo "Labels done for $REPO"
