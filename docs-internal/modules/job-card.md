# Module: job-card (`<abol-job-card>`)

- **Owner:** pair ol (pair ab reviews accessibility) · **Issues:** #14, #37, #38 · **Requirement:** R7 (career gateway)
- **Package:** `packages/job-card`

## Purpose

An accessible job card that graduates can use to find work: readable by screen reader, usable at 200% zoom, with an **audio summary**. Data is exchanged as **schema.org/JobPosting** (Level 3).

## Contract

- **Element (preferred):** `<abol-job-card job-url="…" audio-summary-api="https://HOST">` — a JobPosting **URL**. Cross-origin `job-url` values are loaded via `GET /api/job-postings/resolve?url=…` on the API origin (server-side fetch — avoids browser CORS). Same-origin URLs are fetched directly. Accepts:
  - JSON / JSON-LD (`application/json` or `application/ld+json`)
  - an HTML career page with `<script type="application/ld+json">` JobPosting
  - an HTML career page **without** JSON-LD (scraped from Open Graph / microdata / common career markup)
- **Element (fallback):** inline JSON-LD `<script type="application/ld+json">` inside the element when you cannot host a URL.
- After load, the card always emits clean JobPosting JSON-LD in the light DOM for crawlers (generated if you used a URL).
- **Data:** a JobPosting object (title, hiringOrganization, jobLocation or applicantLocationRequirements, employmentType, datePosted, validThrough, description, baseSalary if provided) plus optional `abolAudioSummary` URL and `abolSummaryText`.
- **Audio API:** the same `audio-summary-api` origin also serves `POST /api/job-summaries/audio` with `{ jobId, text, lang }` (English TTS via AssemblyAI). Audio is generated once per job id + text hash and reused until the summary text changes. Prefer a JobPosting `@id` / `identifier` for stable cache keys.
- **Events:** `abol:job-apply` (host handles the apply action), `abol:summary-play`.
- **CSS variables:** same as the player.

### Level 1 install

```bash
pnpm --filter @abolkit/job-card build
```

```html
<script src="https://HOST/widget/abol-job-card.js"></script>
<abol-job-card job-url="https://HOST/jobs/123.json" audio-summary-api="https://HOST"></abol-job-card>
```

Browser IIFE: `packages/job-card/dist/abol-job-card.js` (Shadow DOM CSS is bundled). Served by the API at `/widget/abol-job-card.js`.

## Design

- Semantic markup: one heading, a definition list for facts (location, type, deadline), plain-language summary first, then details.
- Audio summary: a play/pause button (`aria-pressed`) for a pre-generated clip or one fetched from the job-summary API; loading / error / playback states; the same text is always visible; graceful fallback when audio is missing.
- Responsive and reflowing: no horizontal scroll at 200% zoom and 400% reflow; text spacing overrides do not break it.
- Dates: format with `Intl.DateTimeFormat`, optionally the Ethiopian calendar (spike #13); do not rely on colour alone for status such as "closing soon".
- Emits valid JSON-LD for search engines and the host.
- **Privacy:** no accommodation or disability data is stored or displayed by the card. (The employer-accommodation form belongs to Track 1; not in our scope.)

## Done when

Passes axe; keyboard and screen reader flow is logical; works at 200% zoom with no horizontal scroll; JSON-LD validates; audio summary works and degrades gracefully.

## Test plan

Playwright zoom snapshots; NVDA/TalkBack walkthrough; structured-data validator.

## Risks

Amharic TTS for summaries (reuse the decision from spike #8); long job descriptions on small screens.
