---
title: '@abolkit/player@0.1.1'
description: Install and use the <abol-player> web component at version 0.1.1.
---

Accessible video player (Shadow DOM) with captions, settings, and offline download support. Video.js and `@abolkit/core` are **bundled** in the published files.

## Install

```bash
npm install @abolkit/player@0.1.1
```

```bash
pnpm add @abolkit/player@0.1.1
```

```bash
yarn add @abolkit/player@0.1.1
```

### ESM

```js
import '@abolkit/player'
// registers <abol-player>
```

```html
<abol-player></abol-player>
```

### CDN

```html
<script src="https://cdn.jsdelivr.net/npm/@abolkit/player@0.1.1/dist/abol-player.js"></script>
<abol-player></abol-player>
```

## Dist files (@0.1.1)

| Path | Description |
| --- | --- |
| `dist/abol-player.js` | Default IIFE (CDN / script tag) |
| `dist/abol-player.esm.js` | ESM entry (`import '@abolkit/player'`) |
| `dist/abol-player.lite.js` | Native `<video>`, smallest |
| `dist/abol-player.stream.js` | Default + HLS extras |
| `dist/abol-player.sw.js` | Offline service worker helper |

Lite CDN example:

```html
<script src="https://cdn.jsdelivr.net/npm/@abolkit/player@0.1.1/dist/abol-player.lite.js"></script>
```

## Frameworks

Same custom-element pattern as the job card — see [Frameworks](/install/frameworks/).

```jsx
// after: npm install @abolkit/player@0.1.1
import '@abolkit/player'

export function Lesson() {
  return <abol-player />
}
```

Wire custom events with a `ref` and `addEventListener` (React does not map `onAbol…` automatically).
