# Machine transcription draft (issue #27): placeholder

Pre-computed STT output so the demo never depends on a live model run.

**Placeholder:** these files copy the reviewed captions in `../en.vtt` and `../am.vtt`, with every cue marked `needsReview`. They are **not** real model output yet. Replace them with a real `mms-http` run on the demo clip when the MMS service is available.

| File | Lang | Notes |
|---|---|---|
| `en.vtt` | English | Every cue has `needsReview` |
| `am.vtt` | Amharic | Every cue has `needsReview` |

**Default engine:** `mms-http`, which calls the self-hosted MMS ASR service (`facebook/mms-1b-all`) at `TRANSCRIBER_URL`. The weights live in a separate repo/service, not in abolkit.
