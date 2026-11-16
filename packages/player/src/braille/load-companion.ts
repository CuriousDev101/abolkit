import { getPlayerScriptUrl } from '../offline/register-sw.js'
import {
  ABOL_BRAILLE_GLOBAL,
  ABOL_BRAILLE_READY,
  type AbolBrailleApi,
  type AbolBrailleGlobal,
} from './types.js'

let loadPromise: Promise<AbolBrailleApi> | null = null

function brailleUrlFromPlayerScript(): string | null {
  const playerUrl = getPlayerScriptUrl()
  if (!playerUrl) return null
  try {
    return new URL('abol-player.braille.js', playerUrl).href
  } catch {
    return null
  }
}

function readGlobal(): AbolBrailleApi | null {
  return (globalThis as AbolBrailleGlobal)[ABOL_BRAILLE_GLOBAL] ?? null
}

function readReady(): Promise<AbolBrailleApi> | null {
  return (globalThis as AbolBrailleGlobal)[ABOL_BRAILLE_READY] ?? null
}

/**
 * Lazy-load the GPL companion next to the player script and return its Liblouis API.
 * Main player bundles stay MIT and do not import liblouis.
 */
export function ensureBrailleCompanion(): Promise<AbolBrailleApi> {
  const existing = readGlobal()
  if (existing) return Promise.resolve(existing)
  const ready = readReady()
  if (ready) return ready
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const again = readGlobal()
    if (again) {
      resolve(again)
      return
    }
    const pending = readReady()
    if (pending) {
      pending.then(resolve, reject)
      return
    }
    const src = brailleUrlFromPlayerScript()
    if (!src) {
      reject(
        new Error(
          'Braille companion URL unknown. Load the player via a <script src="…/abol-player.js"> tag so the sibling abol-player.braille.js can be resolved.',
        ),
      )
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      const api = readGlobal()
      if (api) {
        resolve(api)
        return
      }
      const boot = readReady()
      if (boot) {
        boot.then(resolve, reject)
        return
      }
      reject(new Error('abol-player.braille.js loaded but did not register __abolBraille'))
    }
    script.onerror = () => {
      loadPromise = null
      reject(new Error(`Failed to load Braille companion from ${src}`))
    }
    document.head.append(script)
  })

  return loadPromise
}
