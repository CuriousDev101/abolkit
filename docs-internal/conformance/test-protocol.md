# Test protocol

How we test. Every run is logged in `test-runs.md` (create on first run) with date, build/commit, tester, device/browser, result and filed defects. The gate asks for: NVDA, TalkBack, keyboard only, 200% zoom, sound off, and axe-core with zero critical or serious issues.

## 1. Automated (every PR, #47)

- `axe-core` via Playwright on: player (isolated page), player in the Savanna copy, job card, verify page, review editor, docs site. **Zero critical/serious.**
- `eslint-plugin-jsx-a11y` lint. Lighthouse accessibility as a secondary signal.
- Playwright scripts: keyboard walk through the player, caption settings persist, sign-window drift test, offline test.

## 2. Manual protocol (#48)

| Run | How | Pass looks like |
|---|---|---|
| Keyboard only | Unplug the mouse. Tab through, activate every control, open/close menus, move and resize the sign window by keys | Every function reachable; visible focus; no traps; logical order |
| NVDA + Firefox/Chrome (Windows) | Browse mode and forms mode through the page; play, toggle captions, toggle AD, change settings | Names, roles, states announced; changes announced once; Amharic read in the right voice or noted as a limitation |
| TalkBack + Chrome (Android) | Swipe through; double-tap; adjust sliders | Same as above on a real phone |
| 200% zoom | Browser zoom 200%; also text-only zoom | No loss of content or function; no horizontal scroll (job card) |
| 400% / 320 px reflow | Narrow window | Reflows without two-dimensional scroll (except the video itself) |
| Sound off | Mute device; complete the main task | Everything needed is visible: captions, transcript, visible states |
| Reduced motion | Enable OS setting | No non-essential animation |
| Contrast | Colour contrast checker on all states | 4.5:1 text, 3:1 UI components and focus indicators |
| Text spacing | Apply the WCAG 1.4.12 spacing bookmarklet | No clipping or overlap |
| Slow 3G + low-end Android | DevTools throttling, then a real cheap phone | Usable load time; offline pack works; record size and times |
| Ethiopic | Phone without an Ethiopic font; large caption size | Amharic renders; lines wrap sensibly |

## 3. Main task for the co-designer (#50)

Draft: "Watch the first minute of the lesson in Amharic, change caption size, find the transcript, turn on audio description, open the job card and verify the certificate link." Adapt to what the co-designer uses (screen reader, keyboard, zoom, sound off). Observe without helping; time and note every stumble. Ask what they would change.

## 4. Defect handling

File a GitHub issue with label `area:a11y`, the SC number, steps, device and severity. Fix P0 gate defects before features. Re-test and log the pass.
