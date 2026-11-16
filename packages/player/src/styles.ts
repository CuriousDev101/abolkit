/** Shadow-DOM styles. Hosts theme the player only through the --abol-* custom properties. */
export const PLAYER_CSS = `
:host {
  --abol-accent: #0b6e4f;
  --abol-bg: #0f1412;
  --abol-fg: #f4f7f5;
  --abol-radius: 8px;
  --abol-focus: #ffbf47;
  --abol-transcript-width: clamp(240px, 32%, 380px);
  display: block;
  max-width: var(--abol-max-width, 1200px);
  color: var(--abol-fg);
  font-family: "Noto Sans Ethiopic", "Noto Sans", system-ui, sans-serif;
  line-height: 1.4;
}
:host([hidden]) { display: none; }
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }

.root { container-type: inline-size; background: var(--abol-bg); border-radius: var(--abol-radius); }
.status { margin: 0; padding: 24px; text-align: center; }

/* Video fills the player. The transcript overlays the right side, so opening it does not shrink the video. */
.layout { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); }
.layout[data-transcript]:not(:has(abol-skin)) {
  grid-template-columns: minmax(0, 1fr) var(--abol-transcript-width);
  /* Same height the video has on its own, instead of a 16:9 of the leftover column. */
  height: calc(100cqw * 9 / 16);
}
.layout[data-transcript]:not(:has(abol-skin)) .stage { aspect-ratio: auto; height: 100%; min-height: 0; }
.layout[data-transcript]:not(:has(abol-skin)) .transcript { height: 100%; overflow: hidden; }

.stage {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: var(--abol-radius);
  overflow: hidden;
}
.layout[data-transcript]:not(:has(abol-skin)) .stage { border-radius: var(--abol-radius) 0 0 var(--abol-radius); }
video-player { display: contents; }
abol-skin {
  display: block;
  width: 100%;
  height: 100%;
  --media-accent-color: var(--abol-accent);
  --media-border-radius: 0;
  --media-font-family: inherit;
  --media-controls-before-start: visible;
}
hls-video.stream { display: block; width: 100%; height: 100%; }
youtube-video.stream { display: block; width: 100%; aspect-ratio: 16 / 9; }
.native-frame { position: relative; width: 100%; height: 100%; }
video.main { display: block; width: 100%; height: 100%; object-fit: contain; background: #000; }

/* Native cue rendering is replaced by our styleable overlay. */
video.main::cue { color: transparent; background: transparent; text-shadow: none; }
video.main::-webkit-media-text-track-container { display: none; }

.layers { position: absolute; inset: 0; z-index: 1; pointer-events: none; }

.caption-jobs {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 5;
  max-width: min(320px, calc(100% - 20px));
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(12, 18, 16, 0.88);
  color: var(--abol-fg);
  font-size: 0.78rem;
  line-height: 1.35;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  /* Layers are pointer-events:none; re-enable for Refresh on failed rows. */
  pointer-events: auto;
}
.caption-jobs[data-state="failed"] { outline: 1px solid rgba(255, 120, 100, 0.55); }
.caption-jobs-title {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
}
.caption-jobs-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 4px;
}
.caption-jobs-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  opacity: 0.92;
}
.caption-jobs-list li[data-state="succeeded"] .caption-jobs-meta { color: #9fe7c7; }
.caption-jobs-list li[data-state="running"] .caption-jobs-meta { color: #ffd27a; }
.caption-jobs-list li[data-state="queued"] .caption-jobs-meta { color: #c9d4cf; }
.caption-jobs-list li[data-state="failed"] .caption-jobs-meta { color: #ffb4a8; }
.caption-jobs-lang { font-weight: 500; min-width: 0; }
.caption-jobs-meta { text-align: end; white-space: nowrap; }
.caption-jobs-refresh {
  flex: 0 0 auto;
  margin: 0;
  padding: 0.12rem 0.4rem;
  border: 1px solid rgba(255, 180, 168, 0.45);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #ffb4a8;
  font: inherit;
  font-size: 0.85em;
  cursor: pointer;
  pointer-events: auto;
}
.caption-jobs-refresh:hover,
.caption-jobs-refresh:focus-visible {
  background: rgba(255, 255, 255, 0.12);
  outline: none;
}

.captions {
  position: absolute;
  left: 5%;
  right: 5%;
  z-index: 3;
  text-align: center;
  container-type: inline-size;
  pointer-events: none;
  transition: top 0.2s ease-out, bottom 0.2s ease-out;
}
.captions[data-pos="bottom"],
.captions:not([data-pos]) {
  top: auto;
  bottom: max(12%, calc(48px + var(--media-caption-track-y, 0px)));
}
.captions[data-pos="top"] {
  top: 8%;
  bottom: auto;
}
.layout[data-transcript]:has(abol-skin) .captions { right: calc(var(--abol-transcript-width) + 4%); }
.cue {
  display: inline-block;
  max-width: 100%;
  padding: 0.15em 0.5em;
  border-radius: 4px;
  white-space: pre-line;
  font-size: calc(var(--abol-cue-scale, 1) * clamp(14px, 4cqw, 40px));
  line-height: 1.35;
}
.cue[data-edge="shadow"] { text-shadow: 0 0 0.15em #000, 0 0 0.35em #000; }
.cue[data-edge="outline"] { text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; }

.sign {
  position: absolute;
  min-width: 140px;
  pointer-events: auto;
  background: #111;
  border: 2px solid var(--abol-accent);
  border-radius: 6px;
  overflow: hidden;
  touch-action: none;
}
.sign-bar { display: flex; justify-content: flex-end; gap: 1px; padding: 1px 2px; background: rgba(0, 0, 0, 0.7); cursor: grab; }
.sign-bar:active { cursor: grabbing; }
/* WCAG 2.5.8 minimum target (24px): the bar stays slim so the interpreter keeps the space. */
.sign-bar button {
  min-width: 24px;
  min-height: 24px;
  height: 24px;
  padding: 0 4px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  font-size: 0.8rem;
  line-height: 1;
}
.sign-bar button:hover { background: rgba(255, 255, 255, 0.18); }
.sign-bar button[aria-pressed="true"] { background: color-mix(in srgb, var(--abol-accent) 60%, transparent); }
.sign-media { display: block; width: 100%; background: #000; aspect-ratio: 4 / 3; }
.sign-media > video,
.sign-media > .sign-yt,
.sign-media[data-youtube] > iframe {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  border: 0;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  background: #000;
}
/* Sign YouTube is follower-only: no iframe chrome / clicks. */
.sign-media[data-youtube],
.sign-media[data-youtube] > iframe,
.sign-media > .sign-yt {
  pointer-events: none;
}
.sign-note {
  position: absolute;
  left: 4px;
  right: 28px;
  bottom: 4px;
  margin: 0;
  padding: 2px 4px;
  font-size: 0.7rem;
  color: #fff;
  background: #8a3b00;
  border-radius: 3px;
}
.sign-grip {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 24px;
  height: 24px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, var(--abol-accent) 50%);
}

button, select, input { font: inherit; color: inherit; }
button {
  min-width: 44px;
  min-height: 44px;
  margin: 0;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--abol-fg) 30%, transparent);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
button[aria-pressed="true"], button[aria-expanded="true"] {
  background: color-mix(in srgb, var(--abol-accent) 45%, transparent);
  border-color: var(--abol-accent);
}
:focus-visible { outline: 3px solid var(--abol-focus); outline-offset: 2px; }

/* ── Transcript sidebar ── */
.transcript {
  --tr-bg: #101412;
  --tr-bg-raised: #171c19;
  --tr-line: rgba(255, 255, 255, 0.08);
  --tr-muted: rgba(243, 246, 244, 0.62);
  display: flex;
  flex-direction: column;
  min-height: 0;
  color: #f3f6f4;
  background:
    linear-gradient(180deg, rgba(11, 110, 79, 0.12), transparent 72px),
    var(--tr-bg);
  border-inline-start: 1px solid var(--tr-line);
}
/* Over the video, same height as the frame, so the picture stays the size it has with the transcript closed. */
.layout[data-transcript]:has(abol-skin) .transcript {
  position: absolute;
  z-index: 4;
  inset-block: 0;
  inset-inline-end: 0;
  width: var(--abol-transcript-width);
  border-radius: 0 var(--abol-radius) var(--abol-radius) 0;
  box-shadow: -16px 0 36px rgba(0, 0, 0, 0.42);
}
.tr-head {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 10px 12px 16px;
  border-bottom: 1px solid var(--tr-line);
}
.tr-head-text { min-width: 0; display: grid; gap: 4px; }
.tr-head-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
}
.tr-head h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 650;
  letter-spacing: 0.01em;
  line-height: 1.2;
}
.tr-lang {
  width: fit-content;
  max-width: 100%;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--abol-accent) 22%, transparent);
  color: #d7ffef;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tr-close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  border-color: transparent;
  border-radius: 8px;
  color: var(--tr-muted);
}
.tr-close:hover {
  color: #f3f6f4;
  background: rgba(255, 255, 255, 0.08);
}
.tr-search { flex: none; padding: 12px 12px 6px; }
.tr-search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: var(--tr-bg-raised);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.tr-search-field:focus-within {
  border-color: color-mix(in srgb, var(--abol-accent) 55%, rgba(255, 255, 255, 0.2));
  background: #1a211e;
}
.tr-search-icon { display: grid; color: var(--tr-muted); }
.tr-query {
  width: 100%;
  min-width: 0;
  min-height: 36px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #f3f6f4;
  outline: none;
  box-shadow: none;
}
.tr-query::placeholder { color: rgba(243, 246, 244, 0.42); }
.tr-count {
  display: block;
  min-height: 1.15em;
  padding: 7px 4px 0;
  color: var(--tr-muted);
  font-size: 0.75rem;
}
.tr-count:empty { display: none; }
.tr-body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 8px 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
}
.tr-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.tr-list button {
  display: grid;
  grid-template-columns: 3.1rem minmax(0, 1fr);
  gap: 10px;
  width: 100%;
  min-width: 0;
  min-height: 40px;
  padding: 8px 10px;
  text-align: start;
  line-height: 1.45;
  border: 0;
  border-radius: 10px;
  background: transparent;
  transition: background 0.12s ease;
}
.tr-list button:hover { background: rgba(255, 255, 255, 0.055); }
.tr-text {
  color: rgba(243, 246, 244, 0.92);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}
.tr-time {
  min-width: 0;
  padding-top: 0.12em;
  color: color-mix(in srgb, var(--abol-accent) 82%, #fff);
  font-size: 0.72rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}
.tr-html { padding: 4px 8px; }
.tr-html p { margin: 0 0 0.9em; line-height: 1.6; }
.tr-html [data-a="seek"] { border-radius: 6px; cursor: pointer; }
.tr-html [data-a="seek"]:hover { background: rgba(255, 255, 255, 0.06); }
.tr-body [aria-current="true"] {
  background: color-mix(in srgb, var(--abol-accent) 16%, rgba(255, 255, 255, 0.04));
  box-shadow: inset 3px 0 0 var(--abol-accent);
}
.tr-body [aria-current="true"] .tr-time { color: #d7ffef; }
.tr-body [aria-current="true"] .tr-text { color: #fff; font-weight: 500; }
.tr-html [aria-current="true"] { box-shadow: none; }
.tr-body mark {
  color: inherit;
  background: color-mix(in srgb, var(--abol-focus) 48%, transparent);
  border-radius: 3px;
  padding: 0 1px;
}
.tr-empty {
  margin: 18px 8px;
  padding: 14px;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  color: var(--tr-muted);
  text-align: center;
  font-size: 0.88rem;
  line-height: 1.45;
}

/* Narrow players (phones, small embeds): the transcript stacks under the video. */
@container (max-width: 640px) {
  .layout[data-transcript],
  .layout[data-transcript]:not(:has(abol-skin)) { grid-template-columns: minmax(0, 1fr); height: auto; }
  .layout[data-transcript]:not(:has(abol-skin)) .stage { aspect-ratio: 16 / 9; height: auto; }
  .layout[data-transcript] .stage,
  .layout[data-transcript]:not(:has(abol-skin)) .stage { border-radius: var(--abol-radius) var(--abol-radius) 0 0; }
  .layout[data-transcript]:has(abol-skin) .transcript {
    position: static;
    width: auto;
    inset: auto;
    box-shadow: none;
    border-radius: 0 0 var(--abol-radius) var(--abol-radius);
  }
  .transcript {
    height: min(45vh, 320px);
    border-inline-start: 0;
    border-top: 1px solid color-mix(in srgb, var(--abol-fg) 15%, transparent);
  }
}

/* ── Native-engine fallback controls (the Video.js engine puts these in its control bar) ── */
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border-radius: 0 0 var(--abol-radius) var(--abol-radius);
  background: color-mix(in srgb, var(--abol-bg) 85%, #000);
}
.bar button,
.bar a.offline-pack {
  min-height: 44px;
  min-width: 44px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--abol-fg) 25%, transparent);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.bar button[aria-pressed="true"] { outline: 2px solid var(--abol-accent); outline-offset: 1px; }
.panel { padding: 12px 16px; border-top: 1px solid color-mix(in srgb, var(--abol-fg) 20%, transparent); }
.settings { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px 16px; }
.settings label { display: flex; flex-direction: column; gap: 4px; font-size: 0.9rem; }
.settings select { min-height: 44px; width: 100%; padding: 0 8px; border-radius: 6px; background: var(--abol-bg); border: 1px solid color-mix(in srgb, var(--abol-fg) 30%, transparent); }

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .captions { transition: none; }
  .tr-list button,
  .tr-search-field { transition: none; }
}
`
