# WCAG 2.2 AA checklist (working conformance report)

Fill this in as we build; it becomes the submitted conformance report (#49). Status: `pass`, `fail`, `n/a`, `untested`. Evidence is a link to a test log, issue or screenshot. Scope: `<abol-player>`, `<abol-job-card>`, review editor, verify page, docs site. Check the criteria wording against the official WCAG 2.2 text before submitting; this list highlights the ones most relevant to our modules and is not exhaustive.

| SC | Name | Where it bites us | Status | Evidence |
|---|---|---|---|---|
| 1.1.1 | Non-text content (A) | Icons, poster, sign window, image descriptions | untested | |
| 1.2.1 | Audio-only / video-only (A) | Offline audio pack needs transcript | untested | |
| 1.2.2 | Captions, prerecorded (A) | EN and AM captions | untested | |
| 1.2.3 | AD or media alternative (A) | Text AD / transcript | untested | |
| 1.2.5 | Audio description, prerecorded (AA) | AD text and voice | untested | |
| 1.3.1 | Info and relationships (A) | Semantic controls, headings, transcript, job card | untested | |
| 1.3.2 | Meaningful sequence (A) | Reading order in Shadow DOM | untested | |
| 1.3.4 | Orientation (AA) | Player on phones | untested | |
| 1.3.5 | Identify input purpose (AA) | Settings/forms if any | untested | |
| 1.4.1 | Use of colour (A) | Status, pressed states, job deadline | untested | |
| 1.4.2 | Audio control (A) | AD voice and audio summary can be stopped | untested | |
| 1.4.3 | Contrast minimum (AA) | Controls, captions, text | untested | |
| 1.4.4 | Resize text (AA) | 200% zoom | untested | |
| 1.4.5 | Images of text (AA) | No text in images | untested | |
| 1.4.10 | Reflow (AA) | 400% zoom / 320 CSS px | untested | |
| 1.4.11 | Non-text contrast (AA) | Sliders, focus rings, icons | untested | |
| 1.4.12 | Text spacing (AA) | Captions, job card | untested | |
| 1.4.13 | Content on hover or focus (AA) | Tooltips, menus | untested | |
| 2.1.1 | Keyboard (A) | Everything incl. sign window move/resize | untested | |
| 2.1.2 | No keyboard trap (A) | Menus, fullscreen, sign window mode | untested | |
| 2.1.4 | Character key shortcuts (A) | Single-key player shortcuts | untested | |
| 2.2.1 | Timing adjustable (A) | No timeouts | untested | |
| 2.2.2 | Pause, stop, hide (A) | Moving content, auto-updating transcript highlight | untested | |
| 2.3.1 | Three flashes (A) | Demo video | untested | |
| 2.4.1 | Bypass blocks (A) | Skip links in docs/review editor | untested | |
| 2.4.3 | Focus order (A) | Player, sign window, panels | untested | |
| 2.4.4 | Link purpose (A) | Verify page, docs | untested | |
| 2.4.6 | Headings and labels (AA) | Controls, panels | untested | |
| 2.4.7 | Focus visible (AA) | All controls | untested | |
| 2.4.11 | Focus not obscured, minimum (AA, 2.2) | Floating sign window and sticky host bar | untested | |
| 2.5.1 | Pointer gestures (A) | Drag alternatives | untested | |
| 2.5.3 | Label in name (A) | Voice-control users | untested | |
| 2.5.7 | Dragging movements (AA, 2.2) | Sign window move/resize needs a non-drag path | untested | |
| 2.5.8 | Target size, minimum (AA, 2.2) | Buttons and handles | untested | |
| 3.1.1 | Language of page (A) | Host sets; docs and verify page set it | untested | |
| 3.1.2 | Language of parts (AA) | `lang="am"` on Amharic | untested | |
| 3.2.1 / 3.2.2 | On focus / on input (A) | No surprise context changes | untested | |
| 3.2.6 | Consistent help (A, 2.2) | Docs and help links | untested | |
| 3.3.1 / 3.3.2 | Error identification / labels (A) | Review editor, settings | untested | |
| 3.3.7 | Redundant entry (A, 2.2) | Review editor | untested | |
| 4.1.2 | Name, role, value (A) | Custom controls, ARIA | untested | |
| 4.1.3 | Status messages (AA) | Live regions for language switch, AD, save, job status | untested | |

## Notes for the report

- State the tested combinations: browser + NVDA, Android Chrome + TalkBack, keyboard only, 200% and 400% zoom, sound off, reduced motion.
- List **known limitations** honestly (for example, no real sign content, unreviewed Amharic machine captions).
- Host-page issues (Savanna static pages) are reported separately in `host-baseline.md`.
