# Module: audio-description (AD)

- **Owner:** pair ab (playback), pair ol (clip generation) · **Issues:** #8, #23, #31, #32 · **Requirement:** R4

## Purpose

Describe what is visible and not already spoken (slides, on-screen text, diagrams, demonstrations) for blind and low-vision learners. Maps to WCAG 1.2.3 and 1.2.5.

## One source, several outputs

```
descriptions.<lang>.vtt (kind=descriptions, human reviewed)  = source of truth
  ├─ Text mode:  cues announced via an aria-live="polite" region
  ├─ Voice mode: one audio clip per cue played at the cue time (ducking, optional pause)
  ├─ Transcript: descriptions merged into the transcript (media alternative)
  └─ Offline pack: audio-only version with narration mixed in
```

## Playback design (pair ab)

- Browsers do not render description tracks themselves: handle `cuechange` on a hidden `descriptions` text track (or our own cue loop).
- **Text mode:** write `cue.text` into a visually hidden live region; the user's own screen reader speaks it.
- **Voice mode:** play the clip for the active cue; lower main volume (about 30%) while it plays and restore after. Start only after a user gesture (the toggle).
- **Extended AD:** if a clip is longer than the gap, the manifest sets `pauseVideo: true`; pause the video, play the clip, resume on `ended`.
- Toggle button (`aria-pressed`), mode choice (text or voice), remembered preference, keyboard shortcut only while focused.

## Clip generation (pair ol)

- Per cue: **default is a recorded human clip** (`TTS=recorded-clips`, spike #8). Do not depend on phone OEM Amharic voices or cloud TTS for the demo.
- Playback fallback (player): recorded clip → local `speechSynthesis` only if a matching **local** voice exists → else **text-only** live region (TalkBack/NVDA still get the description).
- Generated TTS (e.g. MMS-TTS Amharic) is optional/research only; `facebook/mms-tts-amh` is **CC-BY-NC 4.0** and stays outside this monorepo. Cloud TTS needs consent (`sendsDataOffHost`).
- Compute clip duration vs cue window and set `pauseVideo`. Output the AD clip manifest from [architecture.md](../architecture.md).
- ffmpeg mix for the audio-only AD track (`adelay`, `amix`, ducking). See `spikes/08-tts/RESULT.md`.

## Writing guidance

Describe visible, meaningful content in present tense, objectively and briefly; do not repeat what is said; prefer a lesson where the speaker says what is on screen (less AD needed). **A blind co-designer reviews the demo descriptions.**

## Done when

Text mode works with NVDA/TalkBack announcements (P0). Voice mode with ducking and extended pauses works on the demo clip (P1). Descriptions appear in the transcript and offline pack.

## Risks

Cheap Android phones often lack Amharic `speechSynthesis` voices (mitigated by recorded clips + text AD). Clip timing overlaps speech; autoplay policy blocks audio (solved by user gesture). MMS-TTS NC licence blocks a commercial self-host default.
