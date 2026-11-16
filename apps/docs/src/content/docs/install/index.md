---
title: Install overview
description: Install Abol Kit packages at version 0.1.1 (npm, CDN, or self-host).
---

All public examples pin **`@0.1.1`**. Do not use `latest` in production or demos.

## Packages

| Package | Version | What it installs |
| --- | --- | --- |
| [`@abolkit/job-card`](/install/job-card/) | **0.1.1** | `<abol-job-card>` + optional React helper. [Usage](/components/job-card/) |
| [`@abolkit/player`](/install/player/) | **0.1.1** | `<abol-player>` (Video.js bundled). [Usage](/components/player/) |
| `@abolkit/core` | **0.1.1** | Shared helpers (usually pulled in by the above) |

Published builds are plain JS. There is **no `workspace:` dependency** in what npm installs.

## Choose a path

1. **[CDN / script tag](/install/cdn/)**: one `<script>` on any HTML page.
2. **npm / pnpm / yarn**: ESM `import` in Vite, webpack, or a framework (see package pages).
3. **Self-host**: build from this repo and serve `/widget/abol-*.js` from the Abol Kit API.

## npm (pin the version)

```bash
npm install @abolkit/job-card@0.1.1
npm install @abolkit/player@0.1.1
```

```bash
pnpm add @abolkit/job-card@0.1.1 @abolkit/player@0.1.1
```

```bash
yarn add @abolkit/job-card@0.1.1 @abolkit/player@0.1.1
```

Then:

```js
import '@abolkit/job-card'
import '@abolkit/player'
```

## Framework hosts

Custom elements work in React, Vue, and Angular. See **[Frameworks](/install/frameworks/)**.
