import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { translateUtf16, type LiblouisCapi } from './liblouis-browser.ts'

const require = createRequire(import.meta.url)

function loadNodeCapiWithTables(): LiblouisCapi {
  const { EasyApi } = require('liblouis/easy-api.js') as {
    EasyApi: new (build?: unknown) => { capi: LiblouisCapi; getFilesystem(): {
      mkdir(path: string): void
      writeFile(path: string, data: string): void
    } }
  }
  const build = require('liblouis-build/build-no-tables-utf16.js')
  const api = new EasyApi(build)
  const tablesDir = dirname(require.resolve('liblouis-build/tables/ethio-g1.ctb'))
  const names = [
    'ethio-g1.ctb',
    'en-us-g1.ctb',
    'braille-patterns.cti',
    'chardefs.cti',
    'latinLetterDef8Dots.uti',
    'litdigits6Dots.uti',
    'loweredDigits6Dots.uti',
  ]
  const fs = api.getFilesystem()
  try {
    fs.mkdir('/tables')
  } catch {
    // exists
  }
  for (const name of names) {
    fs.writeFile(`/tables/${name}`, readFileSync(join(tablesDir, name), 'utf8'))
  }
  return api.capi
}

describe('translateUtf16', () => {
  it('matches ethio-g1 smoke samples including expanding phrases', () => {
    const capi = loadNodeCapiWithTables()
    const table = 'tables/ethio-g1.ctb'

    expect(translateUtf16(capi, table, 'ሰላም')).toBe('s5lam')
    expect(translateUtf16(capi, table, 'Hello')).toBe(',hello')
    // This phrase overflows upstream EasyApi.translateString (byte-sized outbuf).
    expect(translateUtf16(capi, table, 'አበባ በፀሐይ ውስጥ ይከፈታል።')).toBe('(5b5ba b5&5<5y ws) yk5f5tal4')
    expect(translateUtf16(capi, table, 'በፀሐይ')).toBe('b5&5<5y')
    expect(translateUtf16(capi, table, '')).toBe('')
  })
})
