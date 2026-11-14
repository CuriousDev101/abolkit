# Spike 07: speech-to-text (Amharic + English)

- **Issue:** #7 · **Owner:** pair ol · **Date:** 2026-11-14 · **Timebox:** hackathon day 1

## Question

Which STT engine should be Abol Kit’s **default** for English and Amharic captions?

## Method

- Compared options against privacy, maintainability, Amharic support, and hackathon install cost.
- **MMS ASR** will run as a **separate HTTP wrapper** in another repository / host (Docker or EC2). This monorepo only owns the TypeScript `Transcriber` client.
- Full side-by-side Amharic error marking on the demo clip is recorded when sample audio from #4 is ready; until then the default is chosen on product constraints (self-hosted, no paid lock-in).

## Results

| Option | Accuracy (EN/AM) | Time | Model / HW | Cost | Leaves host? | Notes |
|---|---|---|---|---|---|---|
| faster-whisper | Good EN; AM varies | Medium–slow on CPU | Local weights + CPU/GPU | Free | No (if local) | Strong default alternative; more ops in-process |
| AssemblyAI | Strong multi-lang (verify AM) | Fast | Cloud API | Paid | **Yes** | Optional adapter only + consent |
| **MMS ASR (HTTP wrapper)** | AM-focused family; verify on demo clip | Depends on remote GPU/CPU | Separate Python service | Free self-host; EC2 if remote | No if wrapper is ours | **Chosen default** |

## Pass criteria met?

- [x] Options evaluated for cost, privacy, language support, ops shape
- [ ] Same demo clip through each engine with Amharic speaker error marks (pending #4 sample; fill table when done)
- [x] Recommendation written; ADR 0003 updated
- [x] TypeScript client in `@abolkit/provider-sdk` talks to external MMS wrapper (no model in this repo)

## Decision

**Default transcriber: `mms-http`** — call our self-hosted MMS ASR wrapper via `TRANSCRIBER_URL`.

- Do **not** embed Python/MMS weights in abolkit.
- AssemblyAI stays an optional future adapter (`sendsDataOffHost: true`).
- faster-whisper remains a documented alternative if we later want in-process STT.
- All machine cues stay `needsReview: true` until a human edits them.

## Follow-ups

- Wire worker job `#27` to `createTranscriber({ transcriber: 'mms-http' })`.
- Point Compose / EC2 at the external wrapper image.
- When `#4` clip exists: run smoke curls, fill accuracy row, attach notes under `spikes/07-stt/notes/`.
- Issue `#8` covers TTS (`mms-tts-amh`), not this spike.
