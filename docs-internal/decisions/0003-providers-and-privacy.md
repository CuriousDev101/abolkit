# 0003: Provider adapters, defaults and privacy

- **Status:** Accepted (STT default from spike #7; TTS default from spike #8)
- **Date:** 2026-11-14 (TTS addendum 2026-11-15)
- **Deciders:** both pairs

## Context

Judging gives 15 points to "can be kept running" (low cost, no paid-API lock-in) and 15 to quality/security/privacy (nothing leaves the host without consent). Amharic speech-to-text and text-to-speech quality varies widely by engine. Team finding so far: Whisper is slower than AssemblyAI for multi-language work. Speed matters less because transcription is a background job and demo results are pre-computed; accuracy on Amharic matters more.

## Decision

1. All speech/translation/TTS/storage access goes through `@abolkit/provider-sdk` interfaces. The components never call a provider.
2. **Default STT (spike #7): `mms-http`.** Abol Kit calls a **self-hosted MMS ASR HTTP wrapper** (separate repo / Compose service / EC2) via `TRANSCRIBER_URL`. Python weights do **not** live in this monorepo. See `spikes/07-stt/RESULT.md` and `spikes/07-stt/contract.md`.
3. **Default TTS (spike #8): `recorded-clips`.** Human-recorded AD / summary audio packaged with the lesson. Browser `speechSynthesis` is only an opportunistic on-device fallback when a **local** voice matches the cue language; otherwise AD stays **text-only** (`aria-live`). Meta `mms-tts-amh` is CC-BY-NC 4.0 — useful for research, **not** the product default. Do not vendor TTS weights in this monorepo.
4. **Defaults otherwise work with no paid cloud account:** host-local object storage. Compose uses **MinIO** (mandatory; ADR 0005); local-disk is the same `Storage` adapter for tests / no-Docker.
5. **Cloud providers (for example AssemblyAI, cloud TTS) are optional adapters, off by default.** Each declares `sendsDataOffHost: true`; enabling one requires an explicit config flag (`ALLOW_OFF_HOST_PROVIDERS`) and a consent notice shown in the review editor and in docs. The pitch states which provider produced the demo captions.
6. Machine output is always `needsReview`; a human reviews before captions are called final.
7. No third-party scripts, fonts or analytics at runtime. Uploaded media has a retention setting; downloads use expiring signed URLs.
8. Do not promise languages beyond English and Amharic until a spike shows the engine supports them.

## Consequences

- Pair ol maintains a small TypeScript HTTP client here and the wrapper API contract; model ops live in the MMS ASR repo.
- If the STT wrapper is unreachable, jobs fail with a clear error; demo captions can still be pre-computed static VTT.
- AD voice quality for the pitch depends on recorded clips reviewed with a co-designer, not on OEM Amharic voices.
- Pricing and language lists of cloud services change: re-check if AssemblyAI or cloud TTS is enabled later.

## Evidence

`spikes/07-stt/RESULT.md` (2026-11-14).  
`spikes/08-tts/RESULT.md` (2026-11-15).
