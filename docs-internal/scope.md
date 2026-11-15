# Scope

Source: https://digitalbridge.et/ and the Telegram group. **Re-verify details before relying on them.**

## The challenge

Track 2, *Accessible learning media*: for learners who are Deaf, hard of hearing, blind, or on a slow connection. Today's lessons lack sign language, Amharic subtitles, screen-reader controls and an offline option. We build an **embeddable video player and a transcript pipeline**, as a plug-in module (not a standalone app). One winner per track; winners get a paid two-week hardening sprint with ALX engineers.

## Required (Track 2)

| # | Requirement | Module | Priority |
|---|---|---|---|
| R1 | Player that works by keyboard and screen reader | [player](modules/player.md) | P0 |
| R2 | English and Amharic captions, resizable and recolourable | [captions](modules/captions.md) | P0 |
| R3 | Movable, resizable Ethiopian Sign Language window | [sign-window](modules/sign-window.md) | P0 |
| R4 | Audio description | [audio-description](modules/audio-description.md) | P0 (text) / P1 (voice) |
| R5 | Offline pack for a 3G phone: audio, text, light HTML | [offline-pack](modules/offline-pack.md) | P0 |
| R6 | Tagged PDF and HTML documents with image descriptions | [pipeline](modules/pipeline.md) | HTML P1, PDF P2 |
| R7 | **Career gateway:** accessible job card with audio summary, working at 200% zoom | [job-card](modules/job-card.md) | P0 |
| R8 | **Career gateway:** verifiable certificate links | [credentials](modules/credentials.md) | P0 |

Earns extra: Braille export (.brf); viewer for recorded live sessions with captions and chat log (both P2).

### Braille export (#55) — status

**Experimental exporter shipped (opt-in).** Offline-pack can emit `transcript.am.brf` when `includeBraille: true`, using Liblouis **`ethio-g1.ctb`** (Liblouis 3.12.x / Compose worker packages). Default packs are unchanged.

> **Experimental Amharic Braille output. Linguistic correctness has not yet been independently verified by an Amharic Braille reader.**

Do **not** advertise as validated accessibility support until a human verification record is added under [`spikes/55-braille-brf/RESULT.md`](../spikes/55-braille-brf/RESULT.md). Module notes: [`modules/offline-pack.md`](modules/offline-pack.md).

## Install levels

Must run inside Savanna and install elsewhere by: **Level 1** script tag, **Level 2** REST API with OpenAPI spec, **Level 3** a standard (we use schema.org/JobPosting and Open Badges 3.0). Target all three; Levels 1 and 2 first.

## Gate and scoring (as read from the site)

**Gate (pass/fail before scoring):** a co-designer completes the main task unaided using NVDA, TalkBack, keyboard only, 200% zoom and sound off; axe-core shows zero critical or serious issues; we submit a WCAG 2.2 AA conformance report.

| Points | Criterion | What it means for us |
|---|---|---|
| 30 | Works for the people it is for | Co-designer test, unaided completion |
| 25 | Can be adopted | A judge installs it in an hour from our docs; all three levels earn more |
| 15 | Built for Ethiopia | Amharic, Ethiopic script and calendar, cheap Android on 3G, offline |
| 15 | Quality, security, privacy | Tests, minimum data, consent, nothing leaves the host without consent |
| 15 | Can be kept running | Low cost, no paid-API lock-in, clear README |

**Submission:** code, README, Docker Compose, conformance report. Day 2 build ends 16:30. Prototype is tested with a person with a disability on Saturday (Telegram announcement), so expect to change things.

## Non-goals

- No sign-language avatar, no gesture recognition, no generated signing (wrong signs would harm the people we serve).
- No user accounts or authentication beyond what credentials need.
- No full LMS. Hosts are the Savanna static pages and one plain demo page.
- No promise of Afaan Oromo, Tigrinya or Afar transcripts (feasibility only, #57).
- Braille, tagged PDF and session viewer only after all P0/P1 work.
- Do not advertise Amharic `.brf` as verified accessibility until `#55` human verification is recorded (experimental opt-in only — see Braille status above).

## Assumptions

- Team of four: two pairs (ab, ol). Nobody knows Ethiopian Sign Language; we need organiser/co-designer help for real signed content (#3). Placeholder content is labelled as placeholder in the demo.
- The Savanna starter is static HTML/CSS (`Savanna-static-pages`); "runs inside Savanna" means our script tag works on those pages without breaking them.
- Defaults need no paid accounts and no network. Cloud providers are optional adapters (ADR 0003).

## Open questions (answer in #3, then record here)

- [ ] Pre-written code allowed?
- [ ] Real Savanna API available, or only static pages?
- [ ] Co-designer assigned to our track? Signed sample content?
- [ ] Cloud credits? Self-hosted model guidance?
- [ ] Judging weights and test format on Saturday?
