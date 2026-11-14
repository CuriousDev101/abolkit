# Plan

Times come from the site and Telegram announcements: **verify them**. Hackathon days: **Sat 14 Nov** and **Sun 15 Nov 2026** at ALX Tech Hub, Lideta; day 1 about 09:00-17:00, day 2 build ends **16:30** with submission. A person with a disability tests our prototype on Saturday.

## Phases

| Phase | Issues | Goal |
|---|---|---|
| 0 Setup and spikes | #1-14 | Evidence for every open choice; repo ready; content chosen; unknowns answered |
| 1 Day-1 core | #15-28 | A playable embedded player with captions and a working pipeline skeleton |
| 2 Day-2 integrate and polish | #29-53 | Complete required features, gateway, host integration, tests, conformance, pitch, submission |
| 3 Stretch | #54-58 | Only if all P0 and P1 are done |

Because the co-designer test happens early, aim to have the **embedded player with keyboard-operable controls and captions on the Savanna copy** (#19-21, #41) in front of a tester as soon as possible, then iterate.

## Critical path

`#5 engine spike → #18 engine adapter → #19 element → #20 controls → #21 captions → #41 Savanna embed → #47/#48 testing → #50 co-designer → #49 report → #53 submission`

Second path (pair ol): `#10 → #17 API → #24 upload → #25 queue → #26 ffmpeg → #27 STT → #28 manifest/cues → #29 review editor → #35 pack → #43 compose → #46 docs`.

Pairs depend on each other only through the manifest and VTT contracts, so ol can serve **hand-written sample manifests** from day one and ab can build against them.

## Suggested schedule

| Block | Pair ab | Pair ol |
|---|---|---|
| Before/at kick-off | #5, #6, #12, #13 | #7, #8, #9, #10, #11, #14 |
| Day 1 morning | #15, #18, #19 | #1, #16, #17 |
| Day 1 afternoon | #20, #21, #22, #23; first test with embedded player | #24, #25, #26, #27 |
| Day 1 evening | #41 on Savanna copy; fix findings | #28, #43 (compose draft) |
| Day 2 morning | #31, #33, #34, #36; #47, #48 | #29, #30, #32, #35, #37-40 |
| Day 2 midday | **Feature freeze.** #42, #45, #51 | #44, #46, #43 final |
| Day 2 afternoon | #49, #50; pitch rehearsals | #49, #53; fresh-clone test |

Adjust freely; the order of issue numbers is the order of priority.

## Cut line (drop in this order if behind)

1. All P2 stretch work (#54-58)
2. #51 size-limit CI, #42 plain demo page (keep a minimal version for the pitch)
3. #36 service worker (keep the static offline pack #35)
4. #30 translation (use human-supplied Amharic)
5. #31/#32 voice AD (keep text AD #23)
6. #38 audio summary (keep the job card #37)

**Never cut:** #20, #21, #22, #23, #35, #37, #39, #40, #41, #43, #46-50, #53.

## Budgets (set numbers in #5 and #51, record here)

- Player bundle (gzipped): TBD after #5; current measurements: native + custom UI ~29 KB, Video.js React build ~307 KB (check same-basis gzip).
- Offline pack for the demo lesson: report the real number; target well under a few MB for about 10 minutes of audio at 24 kbps Opus.
- Time to usable on Slow 3G: record in #12.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Poor Amharic STT/TTS | High | Human review step; pre-computed demo; recorded AD clips; honest pitch |
| Video.js fights Shadow DOM or bloats bundle | Medium | MediaEngine seam; exit rules in ADR 0001; native adapter ready |
| No real Ethiopian Sign Language content | High | Generic sync window; placeholder labelled; ask organisers/co-designer (#3) |
| Savanna integration surprises | Medium | Embed early (#6, #41); Shadow DOM isolation |
| Too many services to run | Medium | Local-disk/SQLite/in-process defaults; Compose tested from clean clone |
| Accessibility defects found late | Medium | Keyboard/axe checks from the first UI PR; early co-designer test |
| Team contract drift | Medium | Manifest/VTT in `architecture.md`; PR review by the other pair |
| Fatigue | High | Feature freeze on day 2 midday; rehearse; backup demo recording |

## Demo script (3-4 minutes, rehearse three times, #52)

1. Embed the player on a plain page with one script tag; then on the Savanna copy.
2. Operate by keyboard only; then with a screen reader.
3. Switch captions to Amharic; resize and recolour.
4. Show the sign window moving and resizing (say clearly that the clip is a placeholder, if it is).
5. Audio description in text, then voice.
6. Pipeline: upload, jobs, review editor, WebVTT out.
7. Offline pack: show size; load it on throttled 3G.
8. Job card at 200% zoom with audio summary; verify a certificate link.
9. Open `/docs` (OpenAPI) and say how a host installs at Levels 1, 2, 3.
