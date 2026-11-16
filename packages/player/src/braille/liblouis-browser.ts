/**
 * Browser Liblouis Easy API bootstrap for the GPL companion bundle.
 * The emscripten CAPI is loaded as a sibling classic script (not esbuild-bundled).
 * ethio-g1 table closure is written into the emscripten FS (no on-demand XHR).
 *
 * Note: liblouis EasyApi.translateString sizes the output buffer to the input byte
 * length. Ethiopic Grade 1 expands (often 2+ cells per letter), which overflows the
 * WASM heap and aborts in `_free`. We call `lou_translateString` ourselves with a
 * correctly counted, growable output buffer.
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

type EasyApiInstance = {
  version(): string
  getFilesystem(): {
    mkdir(path: string): void
    writeFile(path: string, data: string): void
  }
  /** Raw emscripten Module (not typed by upstream). */
  capi: LiblouisCapi
}

type EasyApiCtor = new (build?: unknown) => EasyApiInstance

/** Minimal emscripten Module surface used for a safe lou_translateString. */
export type LiblouisCapi = {
  _malloc(size: number): number
  _free(ptr: number): void
  stringToUTF16(str: string, outPtr: number, maxBytesToWrite: number): void
  getValue(ptr: number, type: string): number
  setValue(ptr: number, value: number, type: string): void
  ccall(
    ident: string,
    returnType: string,
    argTypes: string[],
    args: unknown[],
  ): number
  HEAPU16: Uint16Array
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

function freePtr(capi: LiblouisCapi, ptr: number): void {
  if (ptr) capi._free(ptr)
}

/**
 * UTF-16 lou_translateString with character-counted lengths and a growable outbuf.
 * Upstream EasyApi uses byte length as outlen, which overflows on Ethiopic expansion.
 */
export function translateUtf16(capi: LiblouisCapi, table: string, text: string): string {
  if (typeof text !== 'string' || text.length === 0) return ''

  const charSize = capi.ccall('lou_charSize', 'number', [], [])
  if (charSize !== 2) {
    throw new Error(`Expected utf16 liblouis build (charSize=2), got ${charSize}`)
  }

  // Ethiopic g1 often emits 2 cells/letter; punctuation/indicators can add more.
  let outCapacity = Math.max(text.length * 8, 64)

  for (let attempt = 0; attempt < 6; attempt++) {
    const inBytes = (text.length + 1) * charSize
    const outBytes = (outCapacity + 1) * charSize
    const inPtr = capi._malloc(inBytes)
    const outPtr = capi._malloc(outBytes)
    const inLenPtr = capi._malloc(4)
    const outLenPtr = capi._malloc(4)

    try {
      if (!inPtr || !outPtr || !inLenPtr || !outLenPtr) {
        throw new Error('Liblouis malloc failed')
      }

      capi.stringToUTF16(text, inPtr, inBytes)
      capi.setValue(inLenPtr, text.length, 'i32')
      capi.setValue(outLenPtr, outCapacity, 'i32')

      const ok = capi.ccall(
        'lou_translateString',
        'number',
        ['string', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
        [table, inPtr, inLenPtr, outPtr, outLenPtr, null, null, 0],
      )

      if (!ok) {
        const needed = capi.getValue(outLenPtr, 'i32')
        if (needed > outCapacity) {
          outCapacity = needed + 16
          continue
        }
        throw new Error(`Liblouis failed to translate with table ${table}`)
      }

      const outLen = capi.getValue(outLenPtr, 'i32')
      if (outLen < 0 || outLen > outCapacity) {
        throw new Error(`Liblouis returned invalid outlen ${outLen}`)
      }

      const start = outPtr >> 1
      return utf16HeapToString(capi.HEAPU16, start, outLen)
    } finally {
      freePtr(capi, outPtr)
      freePtr(capi, inPtr)
      freePtr(capi, outLenPtr)
      freePtr(capi, inLenPtr)
    }
  }

  throw new Error(`Liblouis failed to translate with table ${table} (output buffer exhausted)`)
}

function utf16HeapToString(heap: Uint16Array, start: number, length: number): string {
  const CHUNK = 8_192
  if (length <= CHUNK) {
    return String.fromCharCode.apply(
      null,
      heap.subarray(start, start + length) as unknown as number[],
    )
  }
  let out = ''
  for (let i = 0; i < length; i += CHUNK) {
    const end = Math.min(i + CHUNK, length)
    out += String.fromCharCode.apply(
      null,
      heap.subarray(start + i, start + end) as unknown as number[],
    )
  }
  return out
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

  const capi = api.capi
  if (!capi?._malloc || !capi.ccall) {
    throw new Error('liblouis EasyApi did not expose emscripten capi')
  }

  return {
    table: ETHIO_G1_TABLE,
    version: () => api.version(),
    translate(text: string, table = ETHIO_G1_TABLE): string {
      return translateUtf16(capi, table, text)
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
