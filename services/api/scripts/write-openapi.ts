import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createApp } from '../src/app.ts'
import { openApiConfig } from '../src/openapi.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../../..')
const out = join(repoRoot, 'spikes/10-zod-openapi/openapi.json')

const app = createApp()
const document = app.getOpenAPI31Document(openApiConfig)
writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`)

const prettier = join(repoRoot, 'node_modules/prettier/bin/prettier.cjs')
const formatted = spawnSync(process.execPath, [prettier, '--write', out], { encoding: 'utf8' })
if (formatted.status !== 0) {
  throw new Error(formatted.stderr || formatted.stdout || 'prettier failed')
}

console.log(out)
