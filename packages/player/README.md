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

MIT
