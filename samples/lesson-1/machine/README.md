# Machine transcription draft (issue #27)

Pre-computed STT output so the demo never depends on a live model run.

| File | Lang | Notes |
|---|---|---|
| `en.vtt` | English | Every cue has `needsReview` |
| `am.vtt` | Amharic | Every cue has `needsReview` |

**Engine (default):** `mms-http` → self-hosted MMS ASR (`facebook/mms-1b-all`) at `TRANSCRIBER_URL`. Weights live in a separate repo/service, not abolkit.

Reviewed captions for the player stay in the parent folder (`../en.vtt`, `../am.vtt`).
