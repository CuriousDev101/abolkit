# `@abolkit/job-card`

Accessible **`<abol-job-card>`** web component for schema.org/JobPosting notices — readable at 200% zoom, with an optional audio summary.

Works as a **script tag**, via **npm ESM**, and inside **React / Vue / Angular**.

## Install

```bash
npm install @abolkit/job-card
# or
pnpm add @abolkit/job-card
```

Published builds are plain JS. There is **no `workspace:` dependency** in the package that npm installs.

## CDN (script tag)

Pin a version (recommended):

```html
<script src="https://cdn.jsdelivr.net/npm/@abolkit/job-card@0.1.1/dist/abol-job-card.js"></script>

<abol-job-card
  job-url="https://example.org/jobs/junior-a11y.json"
  audio-summary-api="https://your-abol-api.example"
  lang="en"
></abol-job-card>
```

Same file on unpkg: `https://unpkg.com/@abolkit/job-card@0.1.1/dist/abol-job-card.js`

Self-host from an Abol Kit API: `/widget/abol-job-card.js`

## ESM (Vite / webpack / frameworks)

```js
import '@abolkit/job-card'
// registers <abol-job-card>
```

```html
<abol-job-card job-url="/jobs/123.json" audio-summary-api="https://api.example"></abol-job-card>
```

## Attributes

| Attribute | Description |
| --- | --- |
| `job-url` | Preferred. Absolute or relative URL to JobPosting JSON, JSON-LD, or an HTML career page. |
| `src` | Alias for `job-url` (use one). |
| `lang` | BCP-47 UI language (`en`, `am-ET`, …). |
| `calendar` | `gregory` (default) or `ethiopic`. |
| `heading-level` | `2`–`6` for the title heading. |
| `audio-summary-api` | API origin for audio summaries **and** cross-origin job resolve (`GET /api/job-postings/resolve`). |

### Fallback: inline JSON-LD

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
| `abol:job-apply` | `{ job, jsonLd, url? }` | Cancelable. If not canceled and `url` exists, the card opens it. |
| `abol:summary-play` | `{ playing, src, job }` | Fires when the audio summary starts/stops. |

```js
card.addEventListener('abol:job-apply', (event) => {
  event.preventDefault()
  // host handles apply
  console.log(event.detail.job.title)
})
```

## CSS variables

Theme via host CSS:

- `--abol-bg`, `--abol-fg`, `--abol-accent`, `--abol-radius`, `--abol-focus`, `--abol-max-width`

## Frameworks

### React

**Option A — custom element directly** (React 19 works best; string attributes are fine):

```jsx
import '@abolkit/job-card'

export function Job({ url }) {
  return (
    <abol-job-card
      job-url={url}
      audio-summary-api="https://api.example"
      lang="en"
    />
  )
}
```

Listen to custom events with a ref + `addEventListener` (React does not map `onAbolJobApply`).

**Option B — wrapper** (attribute sync + events):

```jsx
import { AbolJobCard } from '@abolkit/job-card/react'

export function Job({ url }) {
  return (
    <AbolJobCard
      jobUrl={url}
      audioSummaryApi="https://api.example"
      onJobApply={(detail) => console.log(detail.job.title)}
    />
  )
}
```

`react` is an **optional peer dependency** — only required if you import `@abolkit/job-card/react`.

### Vue 3

Treat the tag as a custom element:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('abol-'),
        },
      },
    }),
  ],
})
```

```vue
<script setup>
import '@abolkit/job-card'
</script>

<template>
  <abol-job-card
    job-url="https://example.org/jobs/1.json"
    audio-summary-api="https://api.example"
  />
</template>
```

### Angular

```ts
import { CUSTOM_ELEMENTS_SCHEMA, Component } from '@angular/core'
import '@abolkit/job-card'

@Component({
  selector: 'app-jobs',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <abol-job-card
      [attr.job-url]="url"
      [attr.audio-summary-api]="api"
    ></abol-job-card>
  `,
})
export class JobsComponent {
  url = 'https://example.org/jobs/1.json'
  api = 'https://api.example'
}
```

## Job URL loading & CORS

- **Same-origin** `job-url`: fetched in the browser (JSON, JSON-LD, or HTML scrape).
- **Cross-origin** `job-url` with `audio-summary-api` set: loaded via  
  `GET {audio-summary-api}/api/job-postings/resolve?url=…`  
  so the browser never hits the career site directly (avoids CORS).

## Local demo

```bash
pnpm --filter @abolkit/job-card build
# open packages/job-card/demo/index.html via any static server
```

## License

MIT
