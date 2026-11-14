# 0003: Provider adapters, defaults and privacy

- **Status:** Proposed
- **Date:** 2026-11-14
- **Deciders:** both pairs

## Context

Judging gives 15 points to "can be kept running" (low cost, no paid-API lock-in) and 15 to quality/security/privacy (nothing leaves the host without consent). Amharic speech-to-text and text-to-speech quality varies widely by engine. Team finding so far: Whisper is slower than AssemblyAI for multi-language work. Speed matters less because transcription is a background job and demo results are pre-computed; accuracy on Amharic matters more.

## Decision (proposed)

1. All speech/translation/TTS/storage access goes through `@abolkit/provider-sdk` interfaces. The components never call a provider.
2. **Defaults work with no cloud account:** self-hosted transcription (for example faster-whisper or MMS, chosen by spike #7), recorded or self-hosted TTS (spike #8), and host-local object storage. Compose uses **MinIO** (mandatory; ADR 0005); local-disk is the same `Storage` adapter for tests / no-Docker.
3. **Cloud providers (for example AssemblyAI) are optional adapters, off by default.** Each declares `sendsDataOffHost: true`; enabling one requires an explicit config flag and a consent notice shown in the review editor and in docs. The pitch states which provider produced the demo captions.
4. Machine output is always `needsReview`; a human reviews before captions are called final.
5. No third-party scripts, fonts or analytics at runtime. Uploaded media has a retention setting; downloads use expiring signed URLs.
6. Do not promise languages beyond English and Amharic until a spike shows the engine supports them.

## Consequences

- Slightly more adapter code; large gain in adoptability and privacy score.
- If the self-hosted default is too poor on Amharic, the demo still works because results are pre-computed and human-reviewed, but the pitch says so honestly.
- Pricing and language lists of cloud services change: re-check at decision time (record date in spike #7).
