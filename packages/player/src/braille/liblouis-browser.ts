/**
 * Browser Liblouis Easy API bootstrap for the GPL companion bundle.
 * The emscripten CAPI is loaded as a sibling classic script (not esbuild-bundled).
 * ethio-g1 table closure is written into the emscripten FS (no on-demand XHR).
 */
import * as easyApiModule from 'liblouis/easy-api.js'

import { EMBEDDED_TABLES } from './embedded-tables.js'
import {
  ABOL_BRAILLE_GLOBAL,
  ABOL_BRAILLE_READY,
  ETHIO_G1_TABLE,
  type AbolBrailleApi,
  type AbolBrailleGlobal,
} from './types.js'

type EasyApiCtor = new (build?: unknown) => {
  translateString(table: string, text: string): string | null
  version(): string
  getFilesystem(): {
    mkdir(path: string): void
    writeFile(path: string, data: string): void
  }
}

function resolveEasyApi(): EasyApiCtor {
  const mod = easyApiModule as { EasyApi?: EasyApiCtor; default?: { EasyApi?: EasyApiCtor } }
  const Ctor = mod.EasyApi ?? mod.default?.EasyApi
  if (!Ctor) throw new Error('liblouis EasyApi constructor not found')
  return Ctor
}

function ensureDir(fs: { mkdir(path: string): void }, path: string): void {
  try {
    fs.mkdir(path)
  } catch {
    // already exists
  }
}

function companionBaseUrl(): string {
  const script = document.currentScript as HTMLScriptElement | null
  if (script?.src) return script.src
  const last = document.querySelector<HTMLScriptElement>('script[src*="abol-player.braille.js"]')
  if (last?.src) return last.src
  throw new Error('Cannot resolve abol-player.braille.js URL for CAPI sibling')
}

function loadClassicScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const el = document.createElement('script')
    el.src = src
    el.async = false
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.append(el)
  })
}

async function loadLiblouisBuild(): Promise<unknown> {
  const g = globalThis as typeof globalThis & { liblouisBuild?: unknown }
  if (g.liblouisBuild) return g.liblouisBuild
  const capiUrl = new URL('abol-player.braille.capi.js', companionBaseUrl()).href
  await loadClassicScript(capiUrl)
  if (!g.liblouisBuild) {
    throw new Error('abol-player.braille.capi.js loaded but liblouisBuild is missing')
  }
  return g.liblouisBuild
}

export async function createBrailleApi(): Promise<AbolBrailleApi> {
  const build = await loadLiblouisBuild()
  const EasyApi = resolveEasyApi()
  const api = new EasyApi(build)
  const fs = api.getFilesystem()
  ensureDir(fs, '/tables')
  for (const [name, content] of Object.entries(EMBEDDED_TABLES)) {
    fs.writeFile(`/tables/${name}`, content)
  }

  return {
    table: ETHIO_G1_TABLE,
    version: () => api.version(),
    translate(text: string, table = ETHIO_G1_TABLE): string {
      const out = api.translateString(table, text)
      if (out == null) {
        throw new Error(`Liblouis failed to translate with table ${table}`)
      }
      return out
    },
  }
}

/** Start companion init and expose both a promise and (when ready) the sync global. */
export function registerBrailleGlobal(): Promise<AbolBrailleApi> {
  const g = globalThis as AbolBrailleGlobal
  if (g[ABOL_BRAILLE_READY]) return g[ABOL_BRAILLE_READY]!
  const ready = createBrailleApi().then((api) => {
    g[ABOL_BRAILLE_GLOBAL] = api
    return api
  })
  g[ABOL_BRAILLE_READY] = ready
  return ready
}
