import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

/**
 * Single-file UMD build next to the package entry (`dist/index.js`).
 * Served at /docs/scalar.js so the docs page does not load jsDelivr
 * (ADR 0003: no third-party runtime scripts).
 */
export function loadScalarStandalone(): string {
  const entry = require.resolve('@scalar/api-reference')
  const file = join(dirname(entry), 'browser/standalone.js')
  return readFileSync(file, 'utf8')
}
