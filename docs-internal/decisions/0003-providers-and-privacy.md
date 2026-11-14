# 0003: Provider adapters, defaults and privacy

- **Status:** Accepted (STT default from spike #7)
- **Date:** 2026-11-14
- **Deciders:** both pairs

## Context

Judging gives 15 points to "can be kept running" (low cost, no paid-API lock-in) and 15 to quality/security/privacy (nothing leaves the host without consent). Amharic speech-to-text and text-to-speech quality varies widely by engine. Team finding so far: Whisper is slower than AssemblyAI for multi-language work. Speed matters less because transcription is a background job and demo results are pre-computed; accuracy on Amharic matters more.

## Decision

1. All speech/translation/TTS/storage access goes through `@abolkit/provider-sdk` interfaces. The components never call a provider.
2. **Default STT (spike #7): `mms-http`.** Abol Kit calls a **self-hosted MMS ASR HTTP wrapper** (separate repo / Compose service / EC2) via `TRANSCRIBER_URL`. Python weights do **not** live in this monorepo. See `spikes/07-stt/RESULT.md` and `spikes/07-stt/contract.md`.
3. **Defaults otherwise work with no paid cloud account:** recorded or self-hosted TTS (spike #8), and host-local object storage. Compose uses **MinIO** (mandatory; ADR 0005); local-disk is the same `Storage` adapter for tests / no-Docker.
4. **Cloud providers (for example AssemblyAI) are optional adapters, off by default.** Each declares `sendsDataOffHost: true`; enabling one requires an explicit config flag and a consent notice shown in the review editor and in docs. The pitch states which provider produced the demo captions.
5. Machine output is always `needsReview`; a human reviews before captions are called final.
6. No third-party scripts, fonts or analytics at runtime. Uploaded media has a retention setting; downloads use expiring signed URLs.
7. Do not promise languages beyond English and Amharic until a spike shows the engine supports them.

## Consequences

- Pair ol maintains a small TypeScript HTTP client here and the wrapper API contract; model ops live in the MMS repo.
- If the wrapper is unreachable, jobs fail with a clear error; demo captions can still be pre-computed static VTT.
- Pricing and language lists of cloud services change: re-check if AssemblyAI is enabled later.

## Evidence

`spikes/07-stt/RESULT.md` (2026-11-14).
