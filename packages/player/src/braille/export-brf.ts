import {
  encodeBrf,
  formatBrf,
  type BrfLayoutOptions,
} from '@abolkit/core'

import { BRF_FILENAME, ETHIO_G1_TABLE } from './types.js'

export type ExportBrfFromLinesOptions = {
  /** Print-text lines (one cue / paragraph each). */
  lines: readonly string[]
  /** Optional title block translated first. */
  title?: string
  table?: string
  layout?: BrfLayoutOptions
  /** Injected translator (tests / companion). */
  translateFn: (text: string, table: string) => string | Promise<string>
}

export type BrowserExportBrfResult = {
  text: string
  bytes: Uint8Array
  filename: string
  cueCount: number
  table: string
  experimental: true
  verificationPending: true
}

/**
 * Translate cue/title lines with Liblouis and format as experimental Amharic BRF.
 * Does not fall back to print text when translation fails.
 */
export async function exportBrfFromLines(
  options: ExportBrfFromLinesOptions,
): Promise<BrowserExportBrfResult> {
  const table = options.table?.trim() || ETHIO_G1_TABLE
  const blocks: string[] = []

  if (options.title?.trim()) {
    blocks.push(await Promise.resolve(options.translateFn(options.title.trim(), table)))
  }

  for (const raw of options.lines) {
    const line = raw.replaceAll('\n', ' ').trim()
    if (!line) {
      blocks.push('')
      continue
    }
    blocks.push(await Promise.resolve(options.translateFn(line, table)))
  }

  const text = formatBrf(blocks, options.layout)
  return {
    text,
    bytes: encodeBrf(text),
    filename: BRF_FILENAME,
    cueCount: options.lines.length,
    table,
    experimental: true,
    verificationPending: true,
  }
}

/** Trigger a browser download of BRF bytes. */
export function downloadBrf(bytes: Uint8Array, filename = BRF_FILENAME): void {
  // Copy into a fresh ArrayBuffer-backed view for DOM Blob typing (TS 5.x / DOM lib).
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.append(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
}
