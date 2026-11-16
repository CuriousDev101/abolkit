---
title: Quickstart
description: Minimal copy-paste examples for Abol Kit @0.1.1.
---

Pin **@0.1.1** everywhere. Start with one of these pages, then open the component guide for more options.

## Player (minimal)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Abol player</title>
  </head>
  <body>
    <abol-player
      src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
      captions="./en.vtt"
      captions-lang="en"
      lang="en"
    ></abol-player>

    <script src="https://cdn.jsdelivr.net/npm/@abolkit/player@0.1.1/dist/abol-player.lite.js"></script>
  </body>
</html>
```

Put a WebVTT file next to the page as `en.vtt`, or change `captions` to your own URL.

More options (sign, transcript, YouTube, caption API): **[Player guide](/components/player/)**.

## Job card (minimal)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Abol job card</title>
  </head>
  <body>
    <abol-job-card job-url="./job.json" lang="en"></abol-job-card>

    <script src="https://cdn.jsdelivr.net/npm/@abolkit/job-card@0.1.1/dist/abol-job-card.js"></script>
  </body>
</html>
```

`job.json` should be a schema.org `JobPosting`. For audio summary, calendar, or React: **[Job card guide](/components/job-card/)**.

## Next

- [Install](/install/) (npm, CDN, self-host)
- [Player](/components/player/)
- [Job card](/components/job-card/)
- [Frameworks](/install/frameworks/)
- [Accessibility](/guides/accessibility/)
