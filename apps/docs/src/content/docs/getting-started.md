---
title: Quickstart
description: One script tag and one element — Abol Kit @0.1.1.
---

Pin **@0.1.1** everywhere. Copy one of these into a static HTML page.

## Job card (CDN)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Abol job card</title>
  </head>
  <body>
    <abol-job-card
      job-url="https://example.org/jobs/123.json"
      audio-summary-api="https://your-api.example"
      lang="en"
    ></abol-job-card>

    <script src="https://cdn.jsdelivr.net/npm/@abolkit/job-card@0.1.1/dist/abol-job-card.js"></script>
  </body>
</html>
```

## Player (CDN)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Abol player</title>
  </head>
  <body>
    <abol-player></abol-player>

    <script src="https://cdn.jsdelivr.net/npm/@abolkit/player@0.1.1/dist/abol-player.js"></script>
  </body>
</html>
```

## Next

- [Install overview](/install/) — npm, CDN, and self-host
- [Job card package](/install/job-card/) — attributes and events
- [Player package](/install/player/) — bundles and variants
- [Frameworks](/install/frameworks/) — React, Vue, Angular
