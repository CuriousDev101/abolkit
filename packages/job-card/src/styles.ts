/**
 * Shadow-DOM styles for `<abol-job-card>`.
 *
 * Aesthetic: “Kaffa workshop” — cool sage paper, forest accent shared with the
 * player, charcoal ink. Hosts theme via `--abol-*` custom properties.
 */
export const JOB_CARD_CSS = `
:host {
  --_bg: var(--abol-bg, #e8f0ea);
  --_fg: var(--abol-fg, #16201b);
  --_accent: var(--abol-accent, #0b6e4f);
  --_radius: var(--abol-radius, 10px);
  --_focus: var(--abol-focus, #ffbf47);

  --_muted: color-mix(in srgb, var(--_fg) 68%, var(--_bg));
  --_accent-ink: color-mix(in srgb, var(--_accent) 72%, #04150f);
  --_rule: color-mix(in srgb, var(--_fg) 14%, var(--_bg));
  --_rule-strong: color-mix(in srgb, var(--_fg) 28%, var(--_bg));
  --_surface: color-mix(in srgb, #ffffff 55%, var(--_bg));
  --_wash-soon: color-mix(in srgb, var(--_focus) 28%, var(--_bg));
  --_wash-closed: color-mix(in srgb, var(--_fg) 7%, var(--_bg));
  --_press: color-mix(in srgb, var(--_accent) 16%, var(--_bg));

  display: block;
  inline-size: 100%;
  max-inline-size: var(--abol-max-width, 46rem);
  min-inline-size: 0;
  container: abol-job-card / inline-size;
  color: var(--_fg);
  font-family: "Noto Sans Ethiopic", "Source Sans 3", "Noto Sans", system-ui, sans-serif;
  font-size: 1rem;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

:host([hidden]),
[hidden] {
  display: none !important;
}

*, *::before, *::after {
  box-sizing: border-box;
}

.card {
  position: relative;
  min-inline-size: 0;
  inline-size: 100%;
  padding: clamp(1.25rem, 0.85rem + 3cqi, 2.1rem);
  background:
    radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--_accent) 9%, transparent), transparent 55%),
    linear-gradient(180deg, var(--_surface), var(--_bg));
  color: var(--_fg);
  border: 1px solid var(--_rule-strong);
  border-radius: var(--_radius);
  box-shadow: 0 1px 0 color-mix(in srgb, #ffffff 40%, transparent) inset;
  overflow-wrap: break-word;
  word-break: normal;
  animation: abol-card-in 0.45s ease both;
}

@keyframes abol-card-in {
  from {
    opacity: 0;
    transform: translateY(0.35rem);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* Signature coffee-pour mark — the one memorable accent */
.masthead {
  min-inline-size: 0;
}

.pour {
  display: block;
  inline-size: 2.85rem;
  block-size: 0.4rem;
  margin-block-end: 1rem;
  background: linear-gradient(90deg, var(--_accent), color-mix(in srgb, var(--_accent) 55%, var(--_focus)));
  border-radius: 2px;
  clip-path: polygon(0 0, 100% 22%, 100% 78%, 0 100%);
  transform-origin: left center;
  animation: abol-pour 0.55s 0.08s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes abol-pour {
  from { transform: scaleX(0.15); opacity: 0.4; }
  to { transform: scaleX(1); opacity: 1; }
}

.title {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
  min-inline-size: 0;
  font-family: Literata, "Noto Serif Ethiopic", "Noto Sans Ethiopic", Georgia, "Times New Roman", serif;
  font-size: clamp(1.35rem, 1.1rem + 2.2cqi, 1.85rem);
  font-weight: 700;
  font-optical-sizing: auto;
  line-height: 1.22;
  letter-spacing: -0.015em;
  color: var(--_fg);
  text-wrap: balance;
}

.title-role {
  min-inline-size: 0;
}

.title-org {
  font-family: "Noto Sans Ethiopic", "Source Sans 3", "Noto Sans", system-ui, sans-serif;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.4;
  color: var(--_muted);
  text-wrap: wrap;
}

.status {
  display: inline-flex;
  align-items: flex-start;
  gap: 0.5rem;
  inline-size: fit-content;
  max-inline-size: 100%;
  margin: 1rem 0 0;
  padding: 0.4rem 0.8rem;
  border-radius: calc(var(--_radius) * 0.55);
  font-size: 0.9375rem;
  font-weight: 650;
  line-height: 1.4;
  color: var(--_fg);
}

.status[data-state="closing-soon"] {
  background: var(--_wash-soon);
  border: 1.5px dashed color-mix(in srgb, var(--_focus) 55%, var(--_rule-strong));
}

.status[data-state="closed"] {
  background: var(--_wash-closed);
  border: 1.5px dotted var(--_rule-strong);
}

.status svg {
  flex: none;
  inline-size: 1.125em;
  block-size: 1.125em;
  margin-block-start: 0.15em;
}

.lead {
  max-inline-size: 60ch;
  margin: 1.25rem 0 0;
  font-size: clamp(1.05rem, 0.98rem + 0.7cqi, 1.175rem);
  line-height: 1.6;
  color: var(--_fg);
}

/* Listening booth under the summary — craft dial, living EQ, soft progress */
.audio-strip {
  display: grid;
  gap: 0.65rem;
  margin-block-start: 1.15rem;
  padding: 0.85rem 0.95rem 0.9rem;
  min-inline-size: 0;
  background:
    radial-gradient(
      120% 90% at 0% 0%,
      color-mix(in srgb, var(--_accent) 12%, transparent),
      transparent 52%
    ),
    linear-gradient(
      165deg,
      color-mix(in srgb, #ffffff 48%, var(--_bg)),
      color-mix(in srgb, var(--_accent) 8%, var(--_bg))
    );
  border: 1px solid var(--_rule-strong);
  border-radius: calc(var(--_radius) * 0.85);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #ffffff 50%, transparent);
}

.audio-kicker {
  margin: 0;
  font-family: Literata, "Noto Serif Ethiopic", Georgia, serif;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--_accent-ink) 88%, var(--_muted));
}

.audio-console {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.85rem;
  align-items: center;
  min-inline-size: 0;
}

.listen {
  margin: 0;
  padding: 0;
  inline-size: 3.1rem;
  block-size: 3.1rem;
  min-inline-size: 3.1rem;
  min-block-size: 3.1rem;
  border-radius: 999px;
  border: 1.5px solid color-mix(in srgb, var(--_accent) 55%, var(--_rule-strong));
  background:
    radial-gradient(
      circle at 35% 30%,
      color-mix(in srgb, #ffffff 55%, var(--_accent)),
      var(--_accent) 62%,
      color-mix(in srgb, var(--_accent) 72%, #04150f)
    );
  color: #ffffff;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 35%, transparent),
    0 1px 0 color-mix(in srgb, var(--_fg) 8%, transparent);
}

.listen:hover {
  filter: brightness(1.05);
}

.listen:active {
  transform: translateY(1px) scale(0.98);
}

.listen[aria-pressed="true"] {
  background:
    radial-gradient(
      circle at 35% 30%,
      color-mix(in srgb, var(--_focus) 35%, var(--_accent)),
      color-mix(in srgb, var(--_accent) 82%, #04150f)
    );
  border-color: color-mix(in srgb, var(--_focus) 45%, var(--_accent-ink));
}

.listen[aria-busy="true"] {
  opacity: 0.72;
  cursor: wait;
  filter: none;
}

.listen .dial {
  display: grid;
  place-items: center;
  inline-size: 100%;
  block-size: 100%;
}

.listen .dial svg {
  inline-size: 1.15rem;
  block-size: 1.15rem;
}

.audio-copy {
  display: grid;
  gap: 0.35rem;
  min-inline-size: 0;
}

.audio-status {
  margin: 0;
  font-weight: 700;
  font-size: 1rem;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--_fg);
  text-wrap: balance;
}

.eq {
  display: inline-flex;
  align-items: flex-end;
  gap: 0.16rem;
  inline-size: 1.55rem;
  block-size: 0.95rem;
}

.eq span {
  display: block;
  flex: none;
  inline-size: 0.16rem;
  min-block-size: 0.2rem;
  border-radius: 1px;
  background: color-mix(in srgb, var(--_accent) 68%, var(--_fg));
  transform-origin: center bottom;
  opacity: 0.55;
}

.eq span:nth-child(1) { block-size: 34%; }
.eq span:nth-child(2) { block-size: 68%; }
.eq span:nth-child(3) { block-size: 48%; }
.eq span:nth-child(4) { block-size: 86%; }
.eq span:nth-child(5) { block-size: 56%; }

.audio-strip[data-playing="true"] .eq span {
  opacity: 1;
  animation: abol-eq 0.9s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
}

.audio-strip[data-playing="true"] .eq span:nth-child(1) { animation-delay: 0s; }
.audio-strip[data-playing="true"] .eq span:nth-child(2) { animation-delay: 0.1s; }
.audio-strip[data-playing="true"] .eq span:nth-child(3) { animation-delay: 0.22s; }
.audio-strip[data-playing="true"] .eq span:nth-child(4) { animation-delay: 0.06s; }
.audio-strip[data-playing="true"] .eq span:nth-child(5) { animation-delay: 0.18s; }

.audio-strip[data-loading="true"] .eq span {
  opacity: 0.4;
  animation: abol-eq-load 1.1s ease-in-out infinite;
}

@keyframes abol-eq {
  0%, 100% { transform: scaleY(0.4); }
  35% { transform: scaleY(1); }
  65% { transform: scaleY(0.62); }
}

@keyframes abol-eq-load {
  0%, 100% { transform: scaleY(0.35); opacity: 0.35; }
  50% { transform: scaleY(0.85); opacity: 0.7; }
}

.audio-track {
  position: relative;
  inline-size: 100%;
  block-size: 0.28rem;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--_fg) 12%, var(--_bg));
}

.audio-track-fill {
  display: block;
  block-size: 100%;
  inline-size: 0%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--_accent) 75%, var(--_focus)),
    var(--_accent)
  );
  transition: inline-size 0.16s linear;
}

.audio-strip[data-playing="true"] .audio-track-fill {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--_accent) 20%, transparent);
}

.audio-note {
  margin: 0;
  max-inline-size: 58ch;
  font-size: 0.9375rem;
  line-height: 1.45;
  color: var(--_muted);
}

.ledger {
  margin: 1.45rem 0 0;
  padding: 0;
  border-block-start: 2px solid color-mix(in srgb, var(--_accent) 35%, var(--_rule-strong));
  min-inline-size: 0;
}

.row {
  display: grid;
  grid-template-columns: minmax(6.5rem, 30%) minmax(0, 1fr);
  gap: 0.2rem 1.15rem;
  padding-block: 0.65rem;
  border-block-end: 1px solid var(--_rule);
  min-inline-size: 0;
}

.row:last-child {
  border-block-end: 0;
}

.row dt {
  margin: 0;
  min-inline-size: 0;
  color: var(--_muted);
  font-size: 0.95rem;
  font-weight: 600;
}

.row dd {
  margin: 0;
  min-inline-size: 0;
  color: var(--_fg);
  font-weight: 650;
  font-variant-numeric: lining-nums tabular-nums;
}

.description {
  max-inline-size: 66ch;
  margin-block-start: 1.4rem;
  min-inline-size: 0;
  overflow-wrap: break-word;
}

.description p {
  margin: 0 0 0.95em;
  line-height: 1.62;
}

.description ul {
  margin: 0 0 0.95em;
  padding-inline-start: 1.3rem;
  line-height: 1.6;
}

.description li {
  margin-block-end: 0.4em;
}

.description li:last-child,
.description > :last-child,
.more > :last-child {
  margin-block-end: 0;
}

.description a {
  color: var(--_accent-ink);
  overflow-wrap: anywhere;
}

details {
  margin-block-start: 0.35rem;
}

summary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-block-size: 46px;
  min-inline-size: 46px;
  padding-block: 0.4rem;
  list-style: none;
  cursor: pointer;
  color: var(--_accent-ink);
  font-weight: 650;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.22em;
}

summary::-webkit-details-marker {
  display: none;
}

summary::before {
  content: "";
  flex: none;
  inline-size: 0.48em;
  block-size: 0.48em;
  border-inline-end: 2px solid currentColor;
  border-block-end: 2px solid currentColor;
  transform: rotate(-45deg);
  transition: transform 0.16s ease;
}

details[open] > summary::before {
  transform: rotate(45deg);
}

.more {
  padding-block-start: 0.55rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
  margin-block-start: 1.55rem;
  padding-block-start: 1.2rem;
  border-block-start: 1px solid var(--_rule);
  min-inline-size: 0;
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-block-size: 46px;
  min-inline-size: 46px;
  max-inline-size: 100%;
  margin: 0;
  font: inherit;
  font-weight: 650;
  line-height: 1.35;
  text-align: center;
  border-radius: calc(var(--_radius) * 0.7);
  cursor: pointer;
  transition: background-color 0.14s ease, border-color 0.14s ease, transform 0.12s ease;
}

button:active {
  transform: translateY(1px);
}

button svg {
  flex: none;
  inline-size: 1.1em;
  block-size: 1.1em;
}

.apply {
  padding: 0.65rem 1.4rem;
  background: var(--_accent);
  color: #ffffff;
  border: 2px solid var(--_accent-ink);
  font-weight: 700;
}

.apply:hover {
  background: color-mix(in srgb, var(--_accent) 82%, #000000);
}

.apply:active {
  background: color-mix(in srgb, var(--_accent) 70%, #000000);
}

.employer {
  display: inline-flex;
  align-items: center;
  min-block-size: 46px;
  min-inline-size: 46px;
  padding-block: 0.4rem;
  max-inline-size: 100%;
  color: var(--_accent-ink);
  font-weight: 650;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.22em;
}

.employer:hover {
  text-decoration-thickness: 2px;
}

:focus-visible {
  outline: 3px solid var(--_focus);
  outline-offset: 2px;
  box-shadow: 0 0 0 2px #0b0c0c;
}

.state-msg {
  margin: 0;
  font-size: 1rem;
  line-height: 1.5;
}

.state-msg[data-kind="error"] {
  padding: 0.75rem 1rem;
  border: 1.5px solid var(--_rule-strong);
  border-radius: calc(var(--_radius) * 0.55);
  font-weight: 650;
}

.sr {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@container abol-job-card (width < 29rem) {
  .row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.15rem;
  }
}

@container abol-job-card (width < 22rem) {
  .actions {
    flex-direction: column;
    align-items: stretch;
  }
  .apply {
    inline-size: 100%;
  }
  .audio-console {
    gap: 0.7rem;
  }
  .listen {
    inline-size: 2.85rem;
    block-size: 2.85rem;
    min-inline-size: 2.85rem;
    min-block-size: 2.85rem;
  }
  .lead {
    margin-block-start: 1.05rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
  }
  .audio-track-fill {
    transition: none !important;
  }
  .audio-strip[data-playing="true"] .eq span,
  .audio-strip[data-loading="true"] .eq span {
    transform: none;
    opacity: 1;
  }
  .audio-strip[data-playing="true"] .eq span:nth-child(1) { block-size: 45%; }
  .audio-strip[data-playing="true"] .eq span:nth-child(2) { block-size: 78%; }
  .audio-strip[data-playing="true"] .eq span:nth-child(3) { block-size: 58%; }
  .audio-strip[data-playing="true"] .eq span:nth-child(4) { block-size: 92%; }
  .audio-strip[data-playing="true"] .eq span:nth-child(5) { block-size: 64%; }
}

@media (forced-colors: active) {
  .card,
  .status,
  .audio-strip {
    border: 1px solid CanvasText;
    background: Canvas;
    box-shadow: none;
  }
  .eq span,
  .audio-track-fill {
    background: CanvasText;
  }
  .audio-track {
    background: Canvas;
    border: 1px solid CanvasText;
  }
  .apply {
    border-color: ButtonText;
    forced-color-adjust: none;
  }
  .listen {
    forced-color-adjust: none;
    background: ButtonFace;
    color: ButtonText;
    border: 2px solid ButtonText;
    filter: none;
    box-shadow: none;
  }
  .listen[aria-pressed="true"] {
    outline: 2px solid Highlight;
    outline-offset: 2px;
    background: Highlight;
    color: HighlightText;
  }
  .pour {
    forced-color-adjust: none;
    background: CanvasText;
  }
  :focus-visible {
    outline-color: Highlight;
    box-shadow: none;
  }
}
`
