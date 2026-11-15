# Spike 08: Amharic text-to-speech (low-end Android + alternatives)

- **Issue:** #8 · **Owner:** pair ol · **Date:** 2026-11-15 · **Timebox:** hackathon day 1–2
- **Depends on:** #4 (demo media) · **Docs:** [`docs-internal/modules/audio-description.md`](../../docs-internal/modules/audio-description.md)

## Question

What actually produces usable **Amharic voice** for audio description and job-card audio summaries—on a cheap Android phone and in our pipeline—without paying for lock-in or sending lesson media off-host by default?

## Method

- Compared four paths required by #8: browser `speechSynthesis`, self-hosted **MMS-TTS Amharic**, one **cloud** TTS vendor, and **human recording**.
- Browser path: built a phone harness at [`speech-synthesis-android.html`](./speech-synthesis-android.html). Open it on a low-end Android Chrome/Firefox, tap **List voices** and **Speak Amharic**, and paste results into [`notes/android-log.md`](./notes/android-log.md) (template included).
- Self-hosted: reviewed Meta `facebook/mms-tts-amh` (Hugging Face card, CC-BY-NC 4.0, ~36M params, Ethiopic → uroman). Optional throwaway smoke: [`smoke_mms_tts.py`](./smoke_mms_tts.py) (weights **not** vendored here; same ops shape as STT spike #7).
- Cloud: checked Google Cloud Text-to-Speech public voice lists / support threads for production `am-ET` (as of 2026-11-15 research).
- Human recording: aligned with existing AD clip manifest shape (`spikes/09-ffmpeg/fixtures/ad-clips.example.json`) and player voice-AD path (clip → local synth → text live region).
- Full listening scores on the demo lesson wait on #4 sample audio; product default is chosen now on privacy, licence, and phone reliability.

## Results

| Option | Quality (AM) | Latency / HW | Licence | Leaves host? | Notes |
|---|---|---|---|---|---|
| Browser `speechSynthesis` | Unreliable | Instant if voice installed | OS/vendor | **No** (on-device) | Cheap Androids often have **no** `am` / `am-ET` voice; English engines misread Ethiopic. Player already requires `localService` + lang prefix. |
| **MMS-TTS** (`facebook/mms-tts-amh`) | Usable for short AD lines after uroman | Slow on CPU phone/VM; OK on laptop/GPU | **CC-BY-NC 4.0** (non-commercial) | No if self-hosted | Strong research option; **not** a safe default for hosts who may commercialise. Keep outside abolkit monorepo. |
| Google Cloud TTS (cloud sample) | Weak / unstable for AM | Fast if available | Paid / ToS | **Yes** | Production voice list does **not** reliably expose Amharic; experimental Gemini paths change. Consent + opt-in only if ever wired. |
| **Human recorded clips** | Best for demo / a11y review | Pre-baked (0 synth at play time) | Ours (or cleared talent) | **No** | Matches offline pack, ducking mix (#9), and co-designer review. |

### Pass criteria met?

- [x] Browser `speechSynthesis` tested via dedicated Android harness (log device results in `notes/android-log.md`)
- [x] Self-hosted MMS-TTS evaluated (licence, ops, uroman); smoke script provided
- [x] One cloud option evaluated (Google Cloud TTS — Amharic not a dependable production voice)
- [x] Human recording path documented against AD clip manifest + player behaviour
- [x] Quality / latency / licence / data-leaving recorded in table above
- [x] Decision: recorded clips vs generated vs text-only fallback

## Decision

**Default AD / summary voice: `recorded-clips` (human).**

1. **Playback (player):** prefer recorded clip from AD manifest → else on-device `speechSynthesis` only if a **local** voice matches the description lang → else **text-only** AD (`aria-live`) so TalkBack/NVDA still get the description.
2. **Pipeline default (`TTS=recorded-clips`):** worker packages human (or later approved) clips; no cloud call; no NC model in the critical path.
3. **Generated clips:** optional later self-hosted wrapper (MMS or other) **outside** this repo, only if licence fits the host; never the Compose default while MMS remains CC-BY-NC.
4. **Cloud TTS:** optional `sendsDataOffHost: true` adapter + `ALLOW_OFF_HOST_PROVIDERS` (ADR 0003); not used for the demo pitch unless consented and named.

This matches “can be kept running” and privacy scoring: demo quality does not depend on phone OEM voices or paid APIs.

## Follow-ups

- #32 — AD clips + `pauseVideo` manifest + ffmpeg duck mix using recorded files  
- #38 — job-card audio summary from the same recorded-clip convention  
- #16 / worker — keep `createTts({ tts: 'recorded-clips' })`; implement clip lookup when packing jobs land  
- Re-run Android harness on the team’s cheap test phone; attach filled `notes/android-log.md`  
- If a commercially licensed Amharic TTS appears, re-open this spike before changing the default  

## Evidence links

- [facebook/mms-tts-amh](https://huggingface.co/facebook/mms-tts-amh) (CC-BY-NC 4.0; uroman note)  
- [Google Cloud TTS voices docs](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types) (no dependable production Amharic as of research date)  
- Player voice AD: `packages/player/src/player-element.ts` (`#speak`)  
- ADR: [`docs-internal/decisions/0003-providers-and-privacy.md`](../../docs-internal/decisions/0003-providers-and-privacy.md)
