import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createLocalDiskStorage } from '@abolkit/provider-sdk'
import { beforeEach, describe, expect, it } from 'vitest'

import { captionsKey, offlinePackKey, opusAudioKey, video240pKey } from '../ffmpeg/keys.ts'
import { buildOfflinePack } from './build.ts'
import { buildZip } from './zip.ts'

const ASSET = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'abolkit-pack-'))
})

describe('buildOfflinePack (#35)', () => {
  it('zips Opus, captions, transcript, and index.html and reports sizes', async () => {
    const store = createLocalDiskStorage({
      root: join(root, 'storage'),
      signingSecret: 'test-signing-secret',
    })

    await store.put(opusAudioKey(ASSET), new Uint8Array([1, 2, 3, 4, 5]), 'audio/opus')
    await store.put(
      captionsKey(ASSET, 'en'),
      new TextEncoder().encode(`WEBVTT

00:00:00.000 --> 00:00:01.000 needsReview
Hello
`),
      'text/vtt',
    )
    await store.put(
      captionsKey(ASSET, 'am'),
      new TextEncoder().encode(`WEBVTT

00:00:00.000 --> 00:00:01.000
ሰላም
`),
      'text/vtt',
    )

    const result = await buildOfflinePack({
      storage: store,
      assetId: ASSET,
      title: 'Demo lesson',
      lang: 'en',
      log: () => {},
    })

    expect(result.packKey).toBe(offlinePackKey(ASSET))
    expect(result.audioFile).toBe('lesson.opus')
    expect(result.transcriptFile).toBe('transcript.html')
    expect(result.captionFiles).toEqual(['captions.en.vtt', 'captions.am.vtt'])
    expect(result.videoFile).toBeNull()
    expect(result.totalBytes).toBe(result.sizes.zipBytes)
    expect(result.sizes.zipBytes).toBeGreaterThan(0)
    expect(result.sizes.files.map((f) => f.name)).toEqual([
      'index.html',
      'lesson.opus',
      'transcript.html',
      'captions.en.vtt',
      'captions.am.vtt',
    ])

    const packed = await store.get(result.packKey)
    expect(packed?.mime).toBe('application/zip')
    expect(packed?.bytes.byteLength).toBe(result.sizes.zipBytes)

    const index = await store.get(`assets/${ASSET}/transcript.html`)
    expect(index).not.toBeNull()
    const transcript = new TextDecoder().decode(index!.bytes)
    expect(transcript).toContain('ሰላም')
    expect(transcript).toContain('needs review')
  })

  it('fails clearly when Opus is missing', async () => {
    const store = createLocalDiskStorage({
      root: join(root, 'storage'),
      signingSecret: 'test-signing-secret',
    })
    await expect(buildOfflinePack({ storage: store, assetId: ASSET })).rejects.toThrow(
      /Opus audio not found/,
    )
  })

  it('includes optional 240p when requested', async () => {
    const store = createLocalDiskStorage({
      root: join(root, 'storage'),
      signingSecret: 'test-signing-secret',
    })
    await store.put(opusAudioKey(ASSET), new Uint8Array([9]), 'audio/opus')
    await store.put(video240pKey(ASSET), new Uint8Array([8, 8]), 'video/mp4')
    await store.put(
      captionsKey(ASSET, 'en'),
      new TextEncoder().encode('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHi\n'),
      'text/vtt',
    )

    const result = await buildOfflinePack({
      storage: store,
      assetId: ASSET,
      includeVideo: true,
    })
    expect(result.videoFile).toBe('lesson-240p.mp4')
    expect(result.sizes.files.some((f) => f.name === 'lesson-240p.mp4')).toBe(true)
  })
})

describe('pack html has no required script', () => {
  it('index and transcript avoid script tags', async () => {
    const { renderIndexHtml, renderTranscriptHtml } = await import('./html.ts')
    const captions = [
      {
        lang: 'en',
        label: 'English',
        fileName: 'captions.en.vtt',
        vtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHi\n',
      },
    ]
    const index = renderIndexHtml({
      title: 'T',
      lang: 'en',
      captions,
      includeVideo: false,
    })
    const transcript = renderTranscriptHtml({ title: 'T', captions })
    expect(index.toLowerCase()).not.toMatch(/<script/)
    expect(transcript.toLowerCase()).not.toMatch(/<script/)
    expect(index).toContain('lesson.opus')
    // Sanity: zip helper still imports cleanly alongside html
    expect(buildZip([{ name: 'a.txt', data: new Uint8Array([1]) }]).byteLength).toBeGreaterThan(0)
  })
})
