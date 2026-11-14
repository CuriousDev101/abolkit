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

Pre-computed pipeline results for the demo lesson live here too, so the demo never depends on a live model run.
