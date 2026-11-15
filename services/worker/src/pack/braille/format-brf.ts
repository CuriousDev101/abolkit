/**
 * Plain-text BRF page layout (#55).
 *
 * Assumptions (configurable):
 * - Liblouis ethio-g1 output is treated as ASCII braille computer notation.
 * - Default literary embosser-style page: 40 cells × 25 lines.
 * - Pages separated by form feed (`\\f`).
 * - Lines end with CRLF (common BRF convention).
 *
 * This is layout only — not a claim of literary Amharic Braille correctness.
 */

export type BrfLayoutOptions = {
  /** Max braille cells per line (default 40). */
  cellsPerLine?: number
  /** Max lines per page before a form feed (default 25). */
  linesPerPage?: number
  /** Line ending (default CRLF). */
  lineEnding?: '\r\n' | '\n'
  /** Page separator (default form feed). */
  pageSeparator?: string
}

export const DEFAULT_BRF_LAYOUT: Required<BrfLayoutOptions> = {
  cellsPerLine: 40,
  linesPerPage: 25,
  lineEnding: '\r\n',
  pageSeparator: '\f',
}

function normalizeLineEndings(text: string): string {
  return text.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
}

/** Wrap a single paragraph of braille ASCII into cell-width lines (no page breaks). */
export function wrapBrailleLine(text: string, cellsPerLine: number): string[] {
  const width = Math.max(1, Math.floor(cellsPerLine))
  const normalized = normalizeLineEndings(text).replaceAll('\t', ' ')
  if (normalized.length === 0) return ['']

  const out: string[] = []
  for (const paragraph of normalized.split('\n')) {
    if (paragraph.length === 0) {
      out.push('')
      continue
    }
    let rest = paragraph
    while (rest.length > width) {
      let breakAt = rest.lastIndexOf(' ', width)
      if (breakAt <= 0) breakAt = width
      out.push(rest.slice(0, breakAt).trimEnd())
      rest = rest.slice(breakAt).trimStart()
    }
    if (rest.length) out.push(rest)
  }
  return out
}

/**
 * Format one or more braille text blocks into a BRF string with page breaks.
 * Empty input yields an empty string (caller may still write a header file).
 */
export function formatBrf(blocks: readonly string[], options: BrfLayoutOptions = {}): string {
  const layout = { ...DEFAULT_BRF_LAYOUT, ...options }
  const lines: string[] = []
  for (const block of blocks) {
    const wrapped = wrapBrailleLine(block, layout.cellsPerLine)
    if (lines.length > 0 && wrapped.length > 0) {
      // Blank line between logical blocks (cues / paragraphs) when space allows.
      lines.push('')
    }
    lines.push(...wrapped)
  }

  if (lines.length === 0) return ''

  const pages: string[] = []
  for (let i = 0; i < lines.length; i += layout.linesPerPage) {
    const pageLines = lines.slice(i, i + layout.linesPerPage)
    pages.push(pageLines.join(layout.lineEnding) + layout.lineEnding)
  }
  return pages.join(layout.pageSeparator)
}

/** Encode BRF as UTF-8 bytes (ASCII subset for ethio-g1 computer braille). */
export function encodeBrf(brfText: string): Uint8Array {
  return new TextEncoder().encode(brfText)
}
