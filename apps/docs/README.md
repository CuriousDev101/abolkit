# apps/docs

Public documentation site ([Starlight](https://starlight.astro.build/)).  
Package install guides pin **`@0.1.1`**.

## Develop

From the repo root:

```bash
pnpm install
pnpm --filter @abolkit/docs dev
```

Or:

```bash
cd apps/docs && pnpm dev
```

## Build

```bash
pnpm --filter @abolkit/docs build
```

Static output: `apps/docs/dist/`.

## Content

- `src/content/docs/` — Markdown / MDX pages
- Sidebar: `astro.config.mjs`

Owner: pair ol (pair ab for component reference). Issues #44–46.
