import { describe, expect, it } from 'vitest'

import { encodeBrf, formatBrf, wrapBrailleLine } from './brf.ts'

describe('wrapBrailleLine', () => {
  it('wraps at cellsPerLine on spaces when possible', () => {
    const lines = wrapBrailleLine('aaaa bbbb cccc dddd', 10)
    expect(lines.every((l) => l.length <= 10)).toBe(true)
    expect(lines.join(' ')).toContain('aaaa')
  })

  it('hard-wraps unbroken runs', () => {
    expect(wrapBrailleLine('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  })

  it('keeps empty paragraph as blank line', () => {
    expect(wrapBrailleLine('', 40)).toEqual([''])
  })
})

describe('formatBrf', () => {
  it('uses CRLF and form feed for multi-page output', () => {
    const many = Array.from({ length: 30 }, (_, i) => `line${i}`)
    const brf = formatBrf(many, { cellsPerLine: 40, linesPerPage: 10 })
    expect(brf).toContain('\r\n')
    expect(brf).toContain('\f')
    const pages = brf.split('\f')
    expect(pages.length).toBeGreaterThan(1)
  })

  it('returns empty string for empty blocks', () => {
    expect(formatBrf([])).toBe('')
  })

  it('separates logical blocks with a blank line', () => {
    const brf = formatBrf(['alpha', 'beta'], { cellsPerLine: 40, linesPerPage: 25 })
    expect(brf.split('\r\n')).toContain('')
  })

  it('encodeBrf yields UTF-8 bytes', () => {
    const bytes = encodeBrf('s5lam\r\n')
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(bytes)).toBe('s5lam\r\n')
  })
})
