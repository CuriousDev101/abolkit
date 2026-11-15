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

.listen {
  margin-block-start: 0.9rem;
  padding: 0.55rem 1.05rem 0.55rem 0.85rem;
  background: transparent;
  color: var(--_fg);
  border: 1.5px solid var(--_rule-strong);
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.listen:hover:not(:disabled) {
  background: color-mix(in srgb, var(--_fg) 6%, var(--_bg));
}

.listen[aria-pressed="true"] {
  background: var(--_press);
  border-color: var(--_accent-ink);
}

.listen[data-state="loading"] {
  opacity: 0.78;
  cursor: wait;
}

.listen:disabled {
  cursor: wait;
}

.listen .spin {
  width: 0.95rem;
  height: 0.95rem;
  border: 2px solid color-mix(in srgb, var(--_fg) 25%, transparent);
  border-block-start-color: var(--_fg);
  border-radius: 50%;
  animation: abol-spin 0.7s linear infinite;
}

@keyframes abol-spin {
  to {
    transform: rotate(360deg);
  }
}

.audio-note {
  margin: 0.55rem 0 0;
  max-inline-size: 58ch;
  font-size: 0.9375rem;
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
  .apply,
  .listen {
    inline-size: 100%;
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
}

@media (forced-colors: active) {
  .card,
  .status,
  .listen {
    border: 1px solid CanvasText;
    background: Canvas;
    box-shadow: none;
  }
  .apply {
    border-color: ButtonText;
    forced-color-adjust: none;
  }
  .listen[aria-pressed="true"] {
    border-width: 3px;
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
