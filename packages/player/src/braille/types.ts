/** Shared contract between the MIT player and the GPL `abol-player.braille.js` companion. */

export const ABOL_BRAILLE_GLOBAL = '__abolBraille'
export const ABOL_BRAILLE_READY = '__abolBrailleReady'

export type AbolBrailleApi = {
  /** Liblouis table id used for Amharic (ethio-g1). */
  table: string
  /** Translate print text to ASCII braille. */
  translate(text: string, table?: string): string
  version(): string
}

export type AbolBrailleGlobal = {
  [ABOL_BRAILLE_GLOBAL]?: AbolBrailleApi
  [ABOL_BRAILLE_READY]?: Promise<AbolBrailleApi>
}

export const ETHIO_G1_TABLE = 'tables/ethio-g1.ctb'
export const BRF_FILENAME = 'transcript.am.brf'
