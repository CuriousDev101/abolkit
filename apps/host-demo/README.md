# apps/host-demo

Test hosts for the modules. Owner: pair ab. Issues #6, #41, #42.

- A script that copies pages from the cloned `Savanna-static-pages` repo and injects our script tag into generated files named `_abol-test-*.html` (git-ignored). The Savanna repo itself is never edited.
- A plain "other site" page on a separate origin to prove portability.

See `docs-internal/modules/host-integration.md`. A working prototype of the injection script and a Preact/Hono sandbox exist in the earlier `accessible-media` sandbox folder and can be ported here.
