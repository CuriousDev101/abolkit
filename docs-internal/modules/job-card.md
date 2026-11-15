# Module: job-card (`<abol-job-card>`)

- **Owner:** pair ol (pair ab reviews accessibility) · **Issues:** #14, #37, #38 · **Requirement:** R7 (career gateway)
- **Package:** `packages/job-card`

## Purpose

An accessible job card that graduates can use to find work: readable by screen reader, usable at 200% zoom, with an **audio summary**. Data is exchanged as **schema.org/JobPosting** (Level 3).

## Contract

- **Element:** `<abol-job-card src="/jobs/123.json">` or an inline JSON-LD `<script type="application/ld+json">` inside the element.
- **Data:** a JobPosting object (title, hiringOrganization, jobLocation or applicantLocationRequirements, employmentType, datePosted, validThrough, description, baseSalary if provided) plus optional `abolAudioSummary` URL and `abolSummaryText`.
- **Audio API:** optional `audio-summary-api="http://127.0.0.1:8787"` calls `POST /api/job-summaries/audio` with `{ jobId, text, lang }` (English TTS via AssemblyAI). Audio is generated once per job id + text hash and reused until the summary text changes. Prefer a JobPosting `@id` / `identifier` for stable cache keys.
- **Events:** `abol:job-apply` (host handles the apply action), `abol:summary-play`.
- **CSS variables:** same as the player.

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
