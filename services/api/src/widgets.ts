import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../../..')

/** Built Level-1 IIFE bundles the API serves under `/widget/*`. */
const WIDGET_FILES: Record<string, string[]> = {
  'abol-job-card.js': [
    join(repoRoot, 'packages/job-card/dist/abol-job-card.js'),
    join(here, '../public/widget/abol-job-card.js'),
  ],
  'abol-player.js': [
    join(repoRoot, 'packages/player/dist/abol-player.js'),
    join(here, '../public/widget/abol-player.js'),
  ],
  'abol-player.lite.js': [
    join(repoRoot, 'packages/player/dist/abol-player.lite.js'),
    join(here, '../public/widget/abol-player.lite.js'),
  ],
  'abol-player.stream.js': [
    join(repoRoot, 'packages/player/dist/abol-player.stream.js'),
    join(here, '../public/widget/abol-player.stream.js'),
  ],
  'abol-player.sw.js': [
    join(repoRoot, 'packages/player/dist/abol-player.sw.js'),
    join(here, '../public/widget/abol-player.sw.js'),
  ],
}

export function resolveWidgetPath(name: string): string | null {
  const candidates = WIDGET_FILES[name]
  if (!candidates) return null
  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return null
}

export function readWidget(name: string): { body: Buffer; path: string } | null {
  const path = resolveWidgetPath(name)
  if (!path) return null
  return { body: readFileSync(path), path }
}

export const WIDGET_NAMES = Object.keys(WIDGET_FILES)
