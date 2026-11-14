import { describe, expect, it } from 'vitest'
import { parseVtt, serializeVtt } from './vtt.js'

describe('parseVtt', () => {
  it('parses a basic cue with hours', () => {
    const cues = parseVtt(`WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello world
`)
    expect(cues).toEqual([{ id: '1', start: 1, end: 4, text: 'Hello world' }])
  })

  it('parses Amharic multi-line cues', () => {
    const cues = parseVtt(`WEBVTT

00:00:00.000 --> 00:00:02.500
ሰላም
ዓለም
`)
    expect(cues).toHaveLength(1)
    expect(cues[0]?.text).toBe('ሰላም\nዓለም')
  })

  it('skips NOTE and STYLE blocks and tolerates missing header', () => {
    const cues = parseVtt(`NOTE this is a note

STYLE
::cue { color: red }

00:00:05.000 --> 00:00:06.000
Only cue
`)
    expect(cues).toEqual([{ start: 5, end: 6, text: 'Only cue' }])
  })

  it('ignores malformed timing', () => {
    const cues = parseVtt(`WEBVTT

00:99:00.000 --> 00:00:01.000
bad
`)
    expect(cues).toEqual([])
  })

  it('round-trips through serializeVtt', () => {
    const input = [
      { id: 'a', start: 0.5, end: 2.25, text: 'One', needsReview: true },
      { start: 3, end: 5, text: 'Two\nlines' },
    ]
    const again = parseVtt(serializeVtt(input))
    expect(again[0]?.text).toBe('One')
    expect(again[0]?.needsReview).toBe(true)
    expect(again[1]?.text).toBe('Two\nlines')
    expect(again[0]?.start).toBeCloseTo(0.5, 3)
    expect(again[0]?.end).toBeCloseTo(2.25, 3)
  })
})
