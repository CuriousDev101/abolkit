# Module: host-integration (Savanna and other sites)

- **Owner:** pair ab · **Issues:** #3, #6, #41, #42 · **Location:** `apps/host-demo`

## What the Savanna starter is

`alx-africa/Savanna-static-pages`: three frozen learner pages (`concept-with-navigation.html`, `homepage-v1-paced.html`, `homepage-v1-self-paced.html`) with Bootstrap, the app's own CSS and a small `static-page.js`. It is a visual/accessibility reference, not the full app. "Runs inside Savanna" therefore means: our script tag works on these pages without breaking them. Re-check with organisers whether more is expected (#3).

## Rules

- **Never edit the cloned Savanna repo.** A script copies a page and injects our tag into a generated file named `_abol-test-*.html` (git-ignored).
- Serve over `http://localhost` (service workers and `fetch` need it); the classic IIFE script must also load from `file://`.
- Shadow DOM isolates our styles from Bootstrap and the app CSS; verify focus, fonts and screen-reader reading inside it.

## Steps

1. Serve the repo (`npx serve .`), read `static-page.js`, list global CSS risks (rules on `button`, `video`, `:focus`, `[hidden]`).
2. Run axe on all three pages; save to `docs-internal/conformance/host-baseline.md` so host issues are not blamed on us.
3. Choose the insertion point on the concept page (lesson body) and the dashboard (job card).
4. Embed via one script tag and element; compare axe results to the baseline; fix conflicts in our code.
5. Build a **plain "other site" page** on a different origin (no framework, one tag) to prove portability (#42).

## Install snippet (Level 1; keep in docs)

```html
<script src="https://HOST/widget/abol-player.js"></script>
<abol-player manifest="https://HOST/api/lessons/lesson-1"></abol-player>
```

Serve `abol-player.sw.js` beside the player script so the embed can register the offline service worker (#36). The worker’s default scope is its directory (e.g. `/widget/`). Optional response header `Service-Worker-Allowed: /` widens scope when the host wants the lesson page shell cached too. Offline still needs HTTPS or `http://localhost`.

## Done when

Player and job card render and work in copies of the Savanna pages; no new axe issues vs the baseline; works from a plain page on another origin.

## Risks

Host CSS leakage, host JS listeners capturing keys, z-index layering with the host's fixed curriculum bar, mismatched fonts for Ethiopic.
