# Module: sign-window

- **Owner:** pair ab · **Issue:** #22 · **Requirement:** R3

## Purpose

A movable, resizable window showing a second video (an Ethiopian Sign Language interpretation) in sync with the lesson.

## Hard rules

- **We do not generate or recognise sign language.** No avatars, no gesture models. We provide the window; real signed content comes from organisers/signers (#3).
- If the clip is a placeholder, the manifest sets `sign.placeholder: true` and the player shows a visible "sample content" note. The pitch says so.

## Design

- Second `<video>` (muted, no own controls) in a floating panel inside the shadow root.
- **Sync:** the main video is the clock. Mirror play, pause, seek and rate. Correct drift when `|sign.currentTime - main.currentTime|` exceeds about 0.3 s (check on `timeupdate`/animation frame). Handle buffering by pausing both and resuming together.
- **Move and resize with a single pointer** (drag header/handles) **and with the keyboard** (WCAG 2.5.7): a "move/resize" mode toggled by a button, arrow keys to move, Shift+arrows to resize, `Esc` to leave. Provide buttons for size presets (small/medium/large) and **dock to corner**.
- Bounds: stays inside the player; does not cover the control bar by default; remembers position and size per viewer; resets with one button.
- Screen readers: the window has an accessible name ("Sign language interpretation"), its controls are labelled, and the video is not announced as content noise.

## Done when

Drag, resize, dock and keyboard modes work; sync stays within tolerance through pause/seek/buffering on a throttled connection; works with a placeholder clip; passes 2.1.1, 2.5.7, 2.5.8.

## Test plan

Playwright drift test (seek and pause sequences); manual keyboard run; touch drag on a phone; co-designer feedback (#50) on whether position and size are usable.

## Open questions

Real ESL sample availability; aspect ratio and recommended minimum size for legibility (ask a signer); a mobile layout where the window docks above or below instead of floating.
