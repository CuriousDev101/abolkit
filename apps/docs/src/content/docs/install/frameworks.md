---
title: Frameworks
description: Use Abol Kit @0.1.1 web components in React, Vue, and Angular.
---

Install the package first (pin **0.1.1**):

```bash
npm install @abolkit/job-card@0.1.1
# and/or
npm install @abolkit/player@0.1.1
```

Import once so the custom element registers, then use the tag in your template.

## React

### Job card (wrapper, recommended)

```jsx
import { AbolJobCard } from '@abolkit/job-card/react'

export function Job() {
  return (
    <AbolJobCard
      jobUrl="https://example.org/jobs/123.json"
      audioSummaryApi="https://api.example"
      lang="en"
      onJobApply={(detail) => console.log(detail.job.title)}
    />
  )
}
```

### Job card (custom element)

```jsx
import '@abolkit/job-card'

export function Job() {
  return (
    <abol-job-card
      job-url="https://example.org/jobs/123.json"
      audio-summary-api="https://api.example"
    />
  )
}
```

Prefer React 19 for unknown custom-element attributes. For custom events without the wrapper, use a `ref` + `addEventListener`.

### Player

```jsx
import { useEffect, useRef } from 'react'
import '@abolkit/player'

export function Lesson() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onReady = (e) => console.log(e.detail.engine)
    el.addEventListener('abol:ready', onReady)
    return () => el.removeEventListener('abol:ready', onReady)
  }, [])

  return (
    <abol-player
      ref={ref}
      src="https://example.org/lesson.mp4"
      captions="/en.vtt"
      captions-lang="en"
      lang="en"
    />
  )
}
```

There is no React wrapper for the player. Use the custom element + `ref` for events. Full guide: **[Player](/components/player/)**.

## Vue 3

Mark `abol-*` tags as custom elements:

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
    job-url="https://example.org/jobs/123.json"
    audio-summary-api="https://api.example"
  />
</template>
```

## Angular

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
  url = 'https://example.org/jobs/123.json'
  api = 'https://api.example'
}
```

## Version checklist

- `package.json` → `"@abolkit/job-card": "0.1.1"` (or `^0.1.1` if you accept patches)
- CDN → `…/@abolkit/job-card@0.1.1/dist/…`
- Do not document or ship `@latest`
