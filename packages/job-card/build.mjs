#!/usr/bin/env node
/* global console */
/**
 * Browser builds for npm + CDN:
 *   dist/abol-job-card.js      IIFE (script tag / unpkg / jsDelivr)
 *   dist/abol-job-card.esm.js  ESM (import from React / Vue / Angular / Vite)
 *   dist/load-job.js           Node-safe JobPosting parse helpers (API proxy)
 *   dist/react.js              Optional React wrapper
 */
import * as esbuild from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = dirname(fileURLToPath(import.meta.url))
mkdirSync(join(root, 'dist'), { recursive: true })

const shared = {
  bundle: true,
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'warning',
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`
function report(outfile) {
  const bytes = readFileSync(join(root, outfile))
  console.log(
    `${outfile.padEnd(28)} ${kb(bytes.length).padStart(9)}  (${kb(gzipSync(bytes, { level: 9 }).length)} gzip)`,
  )
}

await esbuild.build({
  ...shared,
  entryPoints: [join(root, 'src/index.ts')],
  outfile: join(root, 'dist/abol-job-card.js'),
  format: 'iife',
})
report('dist/abol-job-card.js')

await esbuild.build({
  ...shared,
  entryPoints: [join(root, 'src/index.ts')],
  outfile: join(root, 'dist/abol-job-card.esm.js'),
  format: 'esm',
})
report('dist/abol-job-card.esm.js')

await esbuild.build({
  ...shared,
  platform: 'neutral',
  entryPoints: [join(root, 'src/load-job.ts')],
  outfile: join(root, 'dist/load-job.js'),
  format: 'esm',
})
report('dist/load-job.js')

await esbuild.build({
  ...shared,
  entryPoints: [join(root, 'src/react.ts')],
  outfile: join(root, 'dist/react.js'),
  format: 'esm',
  external: ['react', 'react/jsx-runtime', 'react-dom'],
})
report('dist/react.js')

// Ambient typings shipped with the package (hand-written for consumers).
writeFileSync(
  join(root, 'dist/abol-job-card.d.ts'),
  readFileSync(join(root, 'src/abol-job-card.d.ts'), 'utf8'),
)
writeFileSync(join(root, 'dist/react.d.ts'), readFileSync(join(root, 'src/react.d.ts'), 'utf8'))
writeFileSync(join(root, 'dist/load-job.d.ts'), readFileSync(join(root, 'src/load-job.d.ts'), 'utf8'))
console.log('dist/*.d.ts'.padEnd(28) + ' written')
