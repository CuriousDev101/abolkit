import { parseVtt } from '@abolkit/core'

import { encodeBrf, formatBrf, type BrfLayoutOptions } from './format-brf.ts'
import { ETHIO_G1_TABLE, translateToBraille, type TranslateBrailleOptions } from './translate.ts'

export type ExportBrfFromVttOptions = {
  /** WebVTT document (Amharic captions). */
  vtt: string
  /** Lesson title included as first braille block (translated). */
  title?: string
  table?: string
  layout?: BrfLayoutOptions
  translateFn?: TranslateBrailleOptions['translateFn']
  bridgeScript?: string
  pythonPath?: string
  signal?: AbortSignal
}

export type ExportBrfResult = {
  /** BRF text (CRLF + form feeds). */
  text: string
  bytes: Uint8Array
  cueCount: number
  table: string
  /**
   * Experimental Amharic Braille output. Linguistic correctness has not yet been
   * independently verified by an Amharic Braille reader.
   */
  experimental: true
  verificationPending: true
}

/**
 * Parse VTT cues, translate each cue text with Liblouis, format as BRF.
 * Empty VTT / no cues → empty BRF text (still valid to write).
 */
export async function exportBrfFromVtt(options: ExportBrfFromVttOptions): Promise<ExportBrfResult> {
  const table = options.table?.trim() || ETHIO_G1_TABLE
  const cues = parseVtt(options.vtt)
  const blocks: string[] = []

  if (options.title?.trim()) {
    blocks.push(
      await translateToBraille({
        text: options.title.trim(),
        table,
        translateFn: options.translateFn,
        bridgeScript: options.bridgeScript,
        pythonPath: options.pythonPath,
        signal: options.signal,
      }),
    )
  }

  for (const cue of cues) {
    const line = cue.text.replaceAll('\n', ' ').trim()
    if (!line) {
      blocks.push('')
      continue
    }
    blocks.push(
      await translateToBraille({
        text: line,
        table,
        translateFn: options.translateFn,
        bridgeScript: options.bridgeScript,
        pythonPath: options.pythonPath,
        signal: options.signal,
      }),
    )
  }

  const text = formatBrf(blocks, options.layout)
  return {
    text,
    bytes: encodeBrf(text),
    cueCount: cues.length,
    table,
    experimental: true,
    verificationPending: true,
  }
}

export { ETHIO_G1_TABLE }
