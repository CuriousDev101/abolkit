# 0001: Player engine

- **Status:** Accepted (team decision; evidence to be added from spike #5)
- **Date:** 2026-11-14
- **Deciders:** both pairs

## Context

We need a player that works by keyboard and screen reader, runs inside a Shadow DOM, supports custom captions, a synced second video and audio description, and stays light for 3G. Two measurements so far: a native `<video>` build with custom controls, settings and floating sign window was about **29.3 KB**; a Video.js (`@videojs/react`) build was about **307 KB** in its main chunk (plus a small VTT chunk); the `@videojs/html` build split into many chunks. (Confirm both numbers are measured the same way, gzipped.)

## Options considered

1. **Native `<video>` + our own controls:** smallest, full control; we own accessibility of the controls.
2. **Video.js:** established engine and controls, plugins, HLS; much larger, own DOM/CSS, may fight Shadow DOM and custom caption styling.
3. **Media Chrome / Vidstack / Plyr:** middle paths; not yet measured.

## Decision

Use **Video.js** to avoid hitting a wall early, **behind our own `MediaEngine` interface** (`packages/player/src/engine.ts`). Our captions overlay, sign window, audio description and settings talk only to `MediaEngine`. If a bad sign appears we switch to a native adapter.

## Exit rules (switch to native, or evaluate Media Chrome, if any is true)

- Fullscreen, menus or focus do not work correctly inside the shadow root after about two hours of fixing.
- Keyboard or NVDA/TalkBack defects that we cannot fix within a half-day timebox.
- Sign-window sync or caption overlay requires hacks against Video.js internals.
- The built player exceeds the bundle budget set in #5/#51.

## Consequences

- We pay a bundle-size cost; mitigate with lazy-loading the engine and keeping the job card and offline pack free of it.
- Offline pack and audio-only mode must not need Video.js.
- Keep the native adapter skeleton compiling so a swap costs hours.
- UI framework (React vs Preact compat vs plain TS) must be consistent with the chosen engine build.

## Evidence

Spike #5 (`spikes/05-player-engine/RESULT.md`), measurements above.
