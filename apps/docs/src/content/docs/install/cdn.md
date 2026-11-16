---
title: CDN (script tag)
description: Load Abol Kit @0.1.1 from jsDelivr or unpkg with a pinned version.
---

Use a **pinned** CDN URL. Never load `@latest` in docs or production.

## jsDelivr (recommended)

### Job card

```html
<script src="https://cdn.jsdelivr.net/npm/@abolkit/job-card@0.1.1/dist/abol-job-card.js"></script>

<abol-job-card
  job-url="https://example.org/jobs/123.json"
  audio-summary-api="https://your-api.example"
></abol-job-card>
```

### Player

```html
<script src="https://cdn.jsdelivr.net/npm/@abolkit/player@0.1.1/dist/abol-player.js"></script>

<abol-player
  src="https://example.org/lesson.mp4"
  captions="/captions/en.vtt"
  captions-lang="en"
  lang="en"
></abol-player>
```

### Player variants

| File | Use when |
| --- | --- |
| `…/dist/abol-player.js` | Default Video.js build |
| `…/dist/abol-player.lite.js` | Smallest (native `<video>`) |
| `…/dist/abol-player.stream.js` | HLS extras |
| `…/dist/abol-player.braille.js` (+ `.braille.capi.js`) | GPL Liblouis companion for Amharic `.brf` |

Example lite:

```html
<script src="https://cdn.jsdelivr.net/npm/@abolkit/player@0.1.1/dist/abol-player.lite.js"></script>
```

See the **[player guide](/components/player/)** and **[job card guide](/components/job-card/)**.

## unpkg

Same files, pinned:

```text
https://unpkg.com/@abolkit/job-card@0.1.1/dist/abol-job-card.js
https://unpkg.com/@abolkit/player@0.1.1/dist/abol-player.js
```

## Self-host from the API

After `pnpm --filter @abolkit/job-card build` and `pnpm --filter @abolkit/player build`, the API can serve:

```text
https://HOST/widget/abol-job-card.js
https://HOST/widget/abol-player.js
```

Prefer the npm CDN URLs with `@0.1.1` when you are not running the API.
