import { describe, expect, it } from 'vitest'

import { encodeOpus24k, encodeVideo240p, extract16kMono } from './recipes.ts'

describe('ffmpeg recipes (args)', () => {
  it('extract16kMono uses 16 kHz mono MP3 flags from spike #9', async () => {
    const seen: string[][] = []
    await extract16kMono('in.mp4', 'out.mp3', {
      run: async (args) => {
        seen.push(args)
      },
    })
    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual(
      expect.arrayContaining([
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-c:a',
        'libmp3lame',
        '-b:a',
        '32k',
        'out.mp3',
      ]),
    )
  })

  it('encodeOpus24k uses 24 kbps voip Opus flags from spike #9', async () => {
    const seen: string[][] = []
    await encodeOpus24k('in.mp4', 'out.opus', {
      run: async (args) => {
        seen.push(args)
      },
    })
    expect(seen[0]).toEqual(
      expect.arrayContaining([
        '-c:a',
        'libopus',
        '-b:a',
        '24k',
        '-application',
        'voip',
        'out.opus',
      ]),
    )
  })

  it('encodeVideo240p scales to height 240 with baseline H.264', async () => {
    const seen: string[][] = []
    await encodeVideo240p('in.mp4', 'out.mp4', {
      run: async (args) => {
        seen.push(args)
      },
    })
    expect(seen[0]).toEqual(
      expect.arrayContaining([
        '-vf',
        'scale=-2:240',
        '-c:v',
        'libx264',
        '-profile:v',
        'baseline',
        'out.mp4',
      ]),
    )
  })
})
