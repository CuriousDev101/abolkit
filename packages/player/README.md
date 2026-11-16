# `@abolkit/player`

Accessible **`<abol-player>`** web component (Shadow DOM) for captions, descriptions, and offline lesson packs.

## Install

```bash
npm install @abolkit/player
```

Published builds are self-contained browser bundles (Video.js + `@abolkit/core` are already bundled). There is **no `workspace:` dependency** in what npm installs.

## CDN

```html
<script src="https://cdn.jsdelivr.net/npm/@abolkit/player@0.1.1/dist/abol-player.js"></script>
<abol-player></abol-player>
```

Variants:

- `dist/abol-player.js` — default
- `dist/abol-player.lite.js` — native `<video>`, smallest
- `dist/abol-player.stream.js` — HLS extras
- `dist/abol-player.braille.js` + `dist/abol-player.braille.capi.js` — **GPL-3.0** Liblouis companion (lazy-loaded for Amharic `.brf` export; serve both beside the player script)

## Experimental Amharic Braille (`.brf`)

When an Amharic caption track has cues, the transcript panel shows **Export Braille (.brf)**. The first click loads `abol-player.braille.js` (npm [`liblouis`](https://www.npmjs.com/package/liblouis) + `ethio-g1.ctb`) and downloads `transcript.am.brf`.

> Experimental — not independently verified. Hide with `braille-export="off"`.

Main player bundles stay **MIT** and do not embed Liblouis.

## ESM

```js
import '@abolkit/player'
```

## Frameworks

Same pattern as `@abolkit/job-card`:

- **React:** `import '@abolkit/player'` then use `<abol-player … />` (prefer React 19); wire custom events with `ref` + `addEventListener`.
- **Vue 3:** `compilerOptions.isCustomElement: (t) => t.startsWith('abol-')`
- **Angular:** `CUSTOM_ELEMENTS_SCHEMA` + `import '@abolkit/player'`

## License

MIT for the player. `dist/abol-player.braille.js` and `dist/abol-player.braille.capi.js` are **GPL-3.0** (Liblouis).
