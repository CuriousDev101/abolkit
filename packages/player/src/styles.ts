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

.captions {
  position: absolute;
  left: 5%;
  right: 5%;
  bottom: 5%;
  text-align: center;
  container-type: inline-size;
  transform: translateY(var(--media-caption-track-y, 0px));
  transition: transform 0.2s ease-out;
}
.captions[data-pos="top"] { top: 5%; bottom: auto; transform: none; }
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
.sign video { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #000; }
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
  display: flex;
  flex-direction: column;
  min-height: 0;
  color: #f3f6f4;
  background: #121614;
  border-inline-start: 1px solid rgba(255, 255, 255, 0.08);
}
/* Over the video, same height as the frame, so the picture stays the size it has with the transcript closed. */
.layout[data-transcript]:has(abol-skin) .transcript {
  position: absolute;
  z-index: 4;
  inset-block: 0;
  inset-inline-end: 0;
  width: var(--abol-transcript-width);
  border-radius: 0 var(--abol-radius) var(--abol-radius) 0;
  box-shadow: -12px 0 28px rgba(0, 0, 0, 0.45);
}
.tr-head {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 8px 10px 16px;
  background: #121614;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.tr-head h2 { margin: 0; font-size: 0.92rem; font-weight: 600; letter-spacing: 0.01em; }
.tr-close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  border-color: transparent;
  border-radius: 6px;
}
.tr-close:hover { background: color-mix(in srgb, var(--abol-fg) 12%, transparent); }
.tr-search { position: relative; flex: none; padding: 10px 12px 4px; }
.tr-query {
  width: 100%;
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: #0c0f0d;
  color: #f3f6f4;
}
.tr-query::placeholder { color: rgba(243, 246, 244, 0.5); }
.tr-count { display: block; min-height: 1.2em; padding: 6px 2px 0; font-size: 0.8rem; opacity: 0.8; }
.tr-count:empty { display: none; }
.tr-body { position: relative; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 6px 8px 12px; }
.tr-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.tr-list button {
  display: flex;
  gap: 10px;
  width: 100%;
  min-width: 0;
  min-height: 36px;
  padding: 7px 8px;
  text-align: start;
  line-height: 1.45;
  border: 0;
  border-radius: 6px;
  background: transparent;
}
.tr-list button:hover { background: rgba(255, 255, 255, 0.06); }
.tr-time {
  flex: none;
  min-width: 2.6em;
  padding-top: 0.15em;
  color: var(--abol-accent);
  font-size: 0.8em;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.tr-html { padding: 0 8px; }
.tr-html p { margin: 0 0 0.9em; line-height: 1.6; }
.tr-html [data-a="seek"] { border-radius: 3px; cursor: pointer; }
.tr-html [data-a="seek"]:hover { background: color-mix(in srgb, var(--abol-fg) 10%, transparent); }
.tr-body [aria-current="true"] {
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 2px 0 0 var(--abol-accent);
}
.tr-body [aria-current="true"] .tr-time { color: #d7ffef; }
.tr-html [aria-current="true"] { box-shadow: none; }
.tr-body mark { color: inherit; background: color-mix(in srgb, var(--abol-focus) 55%, transparent); border-radius: 2px; }
.tr-empty { margin: 0; padding: 8px; opacity: 0.8; }

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
}
`
