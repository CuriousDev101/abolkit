#!/usr/bin/env node
/**
 * Classic IIFE bundles for the Level-1 script-tag install (also loads from file://).
 *
 *   dist/abol-player.js         Video.js player + <abol-skin> (compat skin with our control group) (default)
 *   dist/abol-player.stream.js  default + Video.js's lightweight <hls-video>: HLS quality levels, audio tracks
 *                               and in-manifest subtitles in every browser
 *   dist/abol-player.lite.js    native <video controls>, no Video.js (smallest, for 3G-first hosts)
 *
 * Size rules (ADR 0001):
 * - Only the @videojs/html entries in ALLOWED_VIDEOJS may be imported; anything else fails the build.
 * - Video.js lazy-loads 50+ locale packs; a single-file IIFE would inline all of them (~220 KB).
 *   We stub the loader: English is built in, other languages fall back to it.
 */
import * as esbuild from 'esbuild'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = dirname(fileURLToPath(import.meta.url))
const ALLOWED_VIDEOJS = new Set([
  '@videojs/html', // UIElement and MenuRadioGroupElement base classes for our controls
  '@videojs/html/video', // CompatVideoSkinElement, extended by <abol-skin>
  '@videojs/html/video/player',
  '@videojs/html/video/compat-skin',
  '@videojs/html/ui/playback-rate-button',
  '@videojs/html/icons', // registerIcons
  '@videojs/html/icons/compat', // quality icon (the compat skin registers only the icons it renders)
  '@videojs/html/media/hls-video', // stream bundle only
  '@videojs/html/media/youtube-video', // YouTube src: iframe adapter (the YouTube IFrame API loads from youtube.com at runtime)
])

const videojsDiet = {
  name: 'videojs-diet',
  setup(build) {
    build.onResolve({ filter: /^@videojs\/html(?:\/|$)/ }, (args) =>
      ALLOWED_VIDEOJS.has(args.path) || args.importer.includes('node_modules')
        ? undefined
        : { errors: [{ text: `Only ${[...ALLOWED_VIDEOJS].join(', ')} may be imported (got ${args.path}).` }] },
    )
    build.onLoad({ filter: /[\\/]@videojs[\\/]core[\\/]dist[\\/][^\\/]+[\\/]core[\\/]i18n[\\/]load-locale\.js$/ }, () => ({
      contents: 'export async function loadLocale() {}',
      loader: 'js',
    }))
  },
}

const bundles = [
  { outfile: 'dist/abol-player.js', videojs: true, hls: false },
  { outfile: 'dist/abol-player.stream.js', videojs: true, hls: true },
  { outfile: 'dist/abol-player.lite.js', videojs: false, hls: false },
]

for (const { outfile, videojs, hls } of bundles) {
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
    define: { __ABOL_VIDEOJS__: String(videojs), __ABOL_HLS__: String(hls) },
    plugins: [videojsDiet],
    logLevel: 'warning',
  })
  const bytes = readFileSync(join(root, outfile))
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`
  console.log(`${outfile.padEnd(28)} ${kb(bytes.length).padStart(9)}  (${kb(gzipSync(bytes, { level: 9 }).length)} gzip)`)
}
