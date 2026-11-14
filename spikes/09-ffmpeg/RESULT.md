# Spike 09: ffmpeg recipes (extract, Opus, 240p, AD duck mix)

- **Issue:** #9 · **Owner:** pair ol · **Date:** 2026-11-14 · **Timebox:** hackathon day 1

## Question

Which ffmpeg recipes should the worker use for STT input, offline audio, 240p video, and an audio-only AD mix with ducking — without pulling the MMS Python model into this repo?

## Method

- Wrote shell recipes under `spikes/09-ffmpeg/recipes/` (throwaway spike code; copy into worker for #26).
- Added `services/worker/Dockerfile` with `ffmpeg` on `node:22-bookworm-slim` (STT stays external via `TRANSCRIBER_URL`).
- Verified with `smoke.sh` inside that image using lavfi fixtures (no demo clip required).

## Results

| Recipe | Command / flags | Measurement | Notes |
|---|---|---|---|
| Extract for STT | `-vn -ac 1 -ar 16000 -c:a libmp3lame -b:a 32k` → `.mp3` | 16 kHz mono MP3; smoke 8s → 32 KB (was ~256 KB WAV) | Feeds external MMS HTTP wrapper (spike #7); not in-process STT |
| Offline audio | `libopus -b:a 24k -ac 1 -ar 48000 -application voip` | ~24 kbps mono Opus; smoke 8s → 36 KB | Offline pack `lesson.opus` |
| 240p video | `scale=-2:240` + `libx264` CRF 28 + AAC 64k | height=240; smoke 8s → 74 KB | Optional pack video; audio-only path preferred for 3G |
| AD mix + duck | `adelay` → `amix` AD → `apad` → `sidechaincompress` → `amix` → Opus 24k | Timed clips duck main; smoke 8s → 48 KB | Matches architecture `ad.<lang>.json` timing |

Smoke (worker image):

```bash
docker build -t abolkit-worker -f services/worker/Dockerfile services/worker
docker run --rm -v "$PWD/spikes/09-ffmpeg:/spike" -w /spike abolkit-worker ./smoke.sh
```

## Pass criteria met?

- [x] Commands that extract 16 kHz mono audio, make 24 kbps Opus audio and a 240p video
- [x] Mix timed AD clips onto the main audio with ducking
- [x] Works inside the worker Docker image; recipes saved in `spikes/09-ffmpeg/`

## Decision

**Keep these recipes** for worker job `#26`:

1. **STT input** = 16 kHz mono **MP3** (32 kbps); send that file to the separate MMS service. Prefer MP3 over WAV to keep intermediate storage small.
2. **Offline audio** = 24 kbps mono Opus (`voip` mode).
3. **240p** = H.264 baseline + light AAC; keep as optional pack entry.
4. **AD offline track** = `sidechaincompress` ducking + delayed clips; CLI shape `start_sec:clip` maps cleanly from the AD clip JSON.

## Follow-ups

- `#26`: wrap these scripts (or equivalent) in the Node worker; log output byte sizes for the offline-pack report.
- `#31` / `#32`: player-side ducking for live voice AD; this spike covers the **pre-mixed** offline audio track.
- When `#4` demo clip lands, re-run smoke on the real file and record sizes in the pitch budget.
