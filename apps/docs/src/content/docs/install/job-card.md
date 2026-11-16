---
title: '@abolkit/job-card@1.0.0'
description: Install the <abol-job-card> web component at version 1.0.0.
---

import { LinkCard } from '@astrojs/starlight/components'

Accessible job notices from schema.org/JobPosting: JSON, JSON-LD, or HTML career pages, with an optional audio summary.

## Install

```bash
npm install @abolkit/job-card@1.0.0
```

```bash
pnpm add @abolkit/job-card@1.0.0
```

```bash
yarn add @abolkit/job-card@1.0.0
```

### ESM

```js
import '@abolkit/job-card'
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
<script src="https://cdn.jsdelivr.net/npm/@abolkit/job-card@1.0.0/dist/abol-job-card.js"></script>
```

## Next

<LinkCard title="How to use <abol-job-card>" href="/components/job-card/" description="Minimal example, common extras, advanced tabs, attributes, events, CSS." />
<LinkCard title="Frameworks" href="/install/frameworks/" description="React wrapper, Vue, Angular." />
