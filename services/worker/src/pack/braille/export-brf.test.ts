import { describe, expect, it } from 'vitest'

import { exportBrfFromVtt } from './export-brf.ts'

const AM_VTT = `WEBVTT

1
00:00:00.000 --> 00:00:02.500
ሰላም

2
00:00:02.500 --> 00:00:05.000
አበባ
`

describe('exportBrfFromVtt', () => {
  it('builds BRF from VTT cues via injected translator', async () => {
    const result = await exportBrfFromVtt({
      vtt: AM_VTT,
      title: 'Demo',
      translateFn: async (text) => `BR:${text}`,
    })
    expect(result.experimental).toBe(true)
    expect(result.verificationPending).toBe(true)
    expect(result.cueCount).toBe(2)
    expect(result.table).toBe('ethio-g1.ctb')
    const text = result.text
    expect(text).toContain('BR:Demo')
    expect(text).toContain('BR:ሰላም')
    expect(text).toContain('\r\n')
    expect(new TextDecoder().decode(result.bytes)).toBe(text)
  })

  it('handles empty VTT (no cues)', async () => {
    const result = await exportBrfFromVtt({
      vtt: 'WEBVTT\n\n',
      translateFn: async (t) => t,
    })
    expect(result.cueCount).toBe(0)
    expect(result.text).toBe('')
  })

  it('handles multiple cues and long lines via layout', async () => {
    const long = 'ሀ'.repeat(80)
    const result = await exportBrfFromVtt({
      vtt: `WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n${long}\n`,
      layout: { cellsPerLine: 20, linesPerPage: 3 },
      translateFn: async (t) => t,
    })
    expect(result.text.split('\f').length).toBeGreaterThan(1)
  })
})
