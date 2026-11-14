# Module: player (`<abol-player>`)

- **Owner:** pair ab · **Issues:** #5, #18, #19, #20, #33, #34, #36 · **Requirement:** R1
- **Package:** `packages/player`

## Purpose

An embeddable video player that a blind, Deaf, hard-of-hearing or low-bandwidth learner can operate: keyboard, screen reader, captions, transcript, offline. Installed with one script tag.

## Contract

See [architecture.md](../architecture.md) (attributes, events, CSS variables, methods). Input is a **lesson manifest**; features whose data is missing are hidden, never broken.

## Design

- **Custom element + Shadow DOM**, built as a single classic IIFE bundle so it loads from `file://` and any host.
- **MediaEngine seam** ([ADR 0001](../decisions/0001-player-engine.md)): Video.js first, native fallback. The engine is lazy-loaded.
- **Layers:** engine (media) · controls · captions overlay · sign window · AD · transcript panel · settings. Each layer only knows `MediaEngine` and the manifest.
- **Settings** stored per viewer (try/catch around storage; works when storage is empty or blocked).
- **No autoplay.** Audio never starts without a user gesture.

## Keyboard map (draft; confirm in #20)

Tab through controls; Space/Enter activate; arrow keys on sliders; `Esc` closes menus/settings. Optional single-key shortcuts (K play/pause, C captions, D description, M mute, S sign window) are **active only while the player has focus and can be switched off** (WCAG 2.1.4).

## Accessibility requirements

Real `<button>`/`<input type=range>` with accessible names and states (`aria-pressed`, `aria-expanded`); visible focus (3:1 against neighbours, not obscured: 2.4.11); 44 px targets (2.5.8); status via polite live regions; `lang` on Amharic; no timeouts; reduced motion respected; works at 200% zoom and 400% reflow; fullscreen keeps controls reachable.

## Done when

- One script tag + element works on a plain page and the Savanna copy (#41).
- Operable by keyboard only and with NVDA and TalkBack (logged in conformance).
- Bundle within budget (plan.md); axe clean in host and isolation.

## Test plan

axe + Playwright keyboard script (#47); manual protocol (#48); co-designer task (#50).

## Risks and open questions

Shadow DOM vs engine UI (fullscreen, popups); React vs Preact vs plain TS depending on engine build; real-device audio autoplay policies.
