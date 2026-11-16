import { describe, expect, it } from 'vitest'

import { exportBrfFromLines } from './export-brf.ts'

describe('exportBrfFromLines', () => {
  it('formats translated cue lines into experimental BRF bytes', async () => {
    const result = await exportBrfFromLines({
      title: 'Lesson',
      lines: ['ሰላም', 'Hello'],
      translateFn: (text) => `X:${text}`,
    })
    expect(result.filename).toBe('transcript.am.brf')
    expect(result.experimental).toBe(true)
    expect(result.verificationPending).toBe(true)
    expect(result.cueCount).toBe(2)
    expect(result.text).toContain('X:Lesson')
    expect(result.text).toContain('X:ሰላም')
    expect(result.text).toContain('X:Hello')
    expect(result.text).toContain('\r\n')
    expect(new TextDecoder().decode(result.bytes)).toBe(result.text)
  })

  it('keeps empty cue slots as blank braille blocks', async () => {
    const result = await exportBrfFromLines({
      lines: ['one', '  ', 'two'],
      translateFn: async (text) => text.toUpperCase(),
    })
    expect(result.cueCount).toBe(3)
    const parts = result.text.split('\r\n')
    expect(parts).toContain('ONE')
    expect(parts).toContain('TWO')
  })
})
