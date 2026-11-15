#!/usr/bin/env node
/* global console */
/**
 * Classic IIFE bundle for the Level-1 script-tag install (also loads from file://).
 *
 *   dist/abol-job-card.js   <abol-job-card> custom element + JobPosting JSON-LD
 */
import * as esbuild from 'esbuild'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = dirname(fileURLToPath(import.meta.url))
const outfile = 'dist/abol-job-card.js'

await esbuild.build({
  entryPoints: [join(root, 'src/index.ts')],
  outfile: join(root, outfile),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'warning',
})

const bytes = readFileSync(join(root, outfile))
const kb = (n) => `${(n / 1024).toFixed(1)} KB`
console.log(
  `${outfile.padEnd(28)} ${kb(bytes.length).padStart(9)}  (${kb(gzipSync(bytes, { level: 9 }).length)} gzip)`,
)
