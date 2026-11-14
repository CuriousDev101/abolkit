# Module: captions

- **Owner:** pair ab · **Issues:** #15, #21 · **Requirement:** R2
- **Code:** `packages/core` (WebVTT), `packages/player` (overlay)

## Purpose

English and Amharic captions the viewer can resize and recolour, readable on small screens and at large text sizes.

## Design

- **WebVTT in and out** via `parseVtt` / `serializeVtt` in `@abolkit/core` (round-trip safe, Ethiopic text, multi-line cues).
- **Own overlay, not `::cue`:** native cue styling is too limited for size, colour, background and position controls. Keep the native `<track>` disabled (`mode="hidden"`) and render cues from `cuechange` or the time loop.
- **Settings:** font size (steps or slider), text colour, background colour and opacity, position (bottom/top), edge style. Persisted per viewer. Defaults give ≥ 4.5:1 contrast.
- **Language switch:** a control listing `captions[]` from the manifest; switching announces the new language via the live region.
- **Fonts:** self-host Noto Sans Ethiopic inside the shadow root; fall back to system Ethiopic fonts; test on a phone with none.
- **Machine-translated or unreviewed cues** carry `needsReview`; the player may show "automatic captions" if any cue is unreviewed.

## Done when

Two caption tracks switch live; all style settings work and persist; Amharic renders correctly at the largest size without clipping; no overlap with the controls; passes 1.4.3, 1.4.4, 1.4.10, 1.4.12.

## Test plan

Unit tests for the VTT parser (including malformed input); visual checks at 200% and 400%; NVDA/TalkBack check that caption changes are not announced redundantly (captions are visual; the live region is only for language switches and descriptions).

## Risks

Long Amharic lines wrapping badly; cue timing drift after human edits; colour pickers that are not accessible (use a small preset palette plus an accessible custom input).
