#!/usr/bin/env node
/* global console */
/** ESM build for npm consumers (no workspace protocol in the published package). */
import * as esbuild from 'esbuild'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = dirname(fileURLToPath(import.meta.url))
mkdirSync(join(root, 'dist'), { recursive: true })

const outfile = 'dist/index.js'
await esbuild.build({
  entryPoints: [join(root, 'src/index.ts')],
  outfile: join(root, outfile),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: ['es2022'],
  minify: false,
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'warning',
})

const bytes = readFileSync(join(root, outfile))
const kb = (n) => `${(n / 1024).toFixed(1)} KB`
console.log(
  `${outfile.padEnd(28)} ${kb(bytes.length).padStart(9)}  (${kb(gzipSync(bytes, { level: 9 }).length)} gzip)`,
)
