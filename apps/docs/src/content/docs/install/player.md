---
title: '@abolkit/player@0.1.1'
description: Install the <abol-player> web component at version 0.1.1.
---

import { LinkCard } from '@astrojs/starlight/components'

Accessible video player (Shadow DOM) with captions, settings, sign video, transcript, and offline download. Video.js and `@abolkit/core` are bundled.

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
```

```html
<abol-player
  src="https://example.org/lesson.mp4"
  captions="/captions/en.vtt"
  captions-lang="en"
  lang="en"
></abol-player>
```

### CDN

```html
<script src="https://cdn.jsdelivr.net/npm/@abolkit/player@0.1.1/dist/abol-player.js"></script>
```

Lite (smallest):

```html
<script src="https://cdn.jsdelivr.net/npm/@abolkit/player@0.1.1/dist/abol-player.lite.js"></script>
```

## Next

<LinkCard title="How to use <abol-player>" href="/components/player/" description="Minimal example, common extras, advanced tabs, attributes, events, CSS." />
<LinkCard title="Accessibility" href="/guides/accessibility/" description="Keyboard map and controls-keys." />
<LinkCard title="Frameworks" href="/install/frameworks/" description="React, Vue, and Angular." />
