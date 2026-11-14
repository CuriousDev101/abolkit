# samples

Demo content used by the player, the pipeline and the pitch (issue #4).

Keep this folder small (demo clip under about 10 MB) and **rights-cleared**. Record, for every file: source, author, licence, and whether it is a placeholder.

| File | What | Source / licence | Placeholder? |
|---|---|---|---|
| `lesson-1/manifest.json` | Demo lesson manifest | team | no |
| `lesson-1/*.vtt`, `transcript.html` | EN/AM captions, EN descriptions, transcript | team | no |
| flower.mp4 (remote URL in manifest) | Short CC0 demo clip from MDN | MDN / CC0 | no |
| sign track (same clip) | Stand-in until real ESL is supplied | MDN / CC0 | **yes** (`placeholder: true`) |
| _(job posting JSON, sample certificate)_ | JobPosting example and Open Badges example | team | no |
| _(demo lesson clip)_ | 60-90 s lesson with some visual-only content | TBD | no |
| _(captions en/am, descriptions en/am)_ | Reviewed text; Amharic checked by a speaker | team | no |
| _(sign-language clip)_ | Real Ethiopian Sign Language content only if supplied by a signer or the organisers; otherwise a clearly labelled stand-in | TBD | yes unless supplied |
| (see `spikes/14-open-badges/fixtures/job-posting.json`) | JobPosting JSON-LD example from spike #14; copy into samples when `#37` lands | team | no |
| (see `spikes/14-open-badges/out/` after `pnpm smoke`) | Signed Open Badges sample (local only; keys not in git) | team | no |

Pre-computed pipeline results for the demo lesson live here too, so the demo never depends on a live model run.
