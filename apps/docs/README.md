# apps/docs

Public documentation site ([Starlight](https://starlight.astro.build/)).  
Package install guides pin **`@0.1.1`**.

## Requirements

- **Node.js `>=22.23.4`** (Astro 7). Check with `node -v`.

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

- `src/content/docs/` : Markdown / MDX pages (guides and component reference)
- `src/styles/custom.css` : docs theme tweaks
- Sidebar: `astro.config.mjs`

Owner: pair ol (pair ab for component reference). Issues #44–46.
