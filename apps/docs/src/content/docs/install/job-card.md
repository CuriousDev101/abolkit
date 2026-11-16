---
title: '@abolkit/job-card@0.1.1'
description: Install and use the <abol-job-card> web component at version 0.1.1.
---

Accessible job notices from schema.org/JobPosting — JSON, JSON-LD, or HTML career pages, with an optional audio summary.

## Install

```bash
npm install @abolkit/job-card@0.1.1
```

```bash
pnpm add @abolkit/job-card@0.1.1
```

```bash
yarn add @abolkit/job-card@0.1.1
```

### ESM

```js
import '@abolkit/job-card'
// registers <abol-job-card>
```

```html
<abol-job-card
  job-url="/jobs/123.json"
  audio-summary-api="https://api.example"
  lang="en"
></abol-job-card>
```

### CDN

```html
<script src="https://cdn.jsdelivr.net/npm/@abolkit/job-card@0.1.1/dist/abol-job-card.js"></script>
```

## Attributes

| Attribute | Description |
| --- | --- |
| `job-url` | Preferred. URL to JobPosting JSON, JSON-LD, or an HTML career page. |
| `src` | Alias for `job-url` (use one). |
| `lang` | BCP-47 UI language (`en`, `am-ET`, …). |
| `calendar` | `gregory` (default) or `ethiopic`. |
| `heading-level` | `2`–`6` for the title heading. |
| `audio-summary-api` | API origin for audio summaries and cross-origin job resolve. |

### Inline JSON-LD fallback

```html
<abol-job-card>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "title": "Junior Accessibility Engineer",
      "description": "Build clear learning tools."
    }
  </script>
</abol-job-card>
```

## Events

| Event | Detail | Notes |
| --- | --- | --- |
| `abol:job-apply` | `{ job, jsonLd, url? }` | Cancelable. Host can `preventDefault()`. |
| `abol:summary-play` | `{ playing, src, job }` | Audio summary started or paused. |

```js
document.querySelector('abol-job-card')?.addEventListener('abol:job-apply', (event) => {
  event.preventDefault()
  console.log(event.detail.job.title)
})
```

## CSS variables

Theme from the host page:

- `--abol-bg`, `--abol-fg`, `--abol-accent`, `--abol-radius`, `--abol-focus`, `--abol-max-width`

## Cross-origin job URLs

With `audio-summary-api` set, cross-origin `job-url` values load via:

```http
GET {audio-summary-api}/api/job-postings/resolve?url=…
```

That avoids browser CORS. Same-origin URLs are fetched directly.

## React helper

```bash
npm install @abolkit/job-card@0.1.1 react
```

```jsx
import { AbolJobCard } from '@abolkit/job-card/react'

export function Job() {
  return (
    <AbolJobCard
      jobUrl="https://example.org/jobs/123.json"
      audioSummaryApi="https://api.example"
      onJobApply={(detail) => console.log(detail.job.title)}
    />
  )
}
```

`react` is an **optional** peer dependency — only required for `@abolkit/job-card/react`.

More framework patterns: [Frameworks](/install/frameworks/).
