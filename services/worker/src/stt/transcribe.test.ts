import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parseVtt } from '@abolkit/core'
import type { JobError } from '@abolkit/jobs'
import {
  createLocalDiskStorage,
  createStubTranscriber,
  ProviderError,
  type Transcriber,
} from '@abolkit/provider-sdk'
import { describe, expect, it } from 'vitest'

import { audio16kKey } from '../ffmpeg/keys.ts'
import { langFromJobParams, markNeedsReview, transcribeStoredAudio } from './index.ts'

describe('langFromJobParams', () => {
  it('defaults to en', () => {
    expect(langFromJobParams({})).toBe('en')
  })

  it('accepts language and lang', () => {
    expect(langFromJobParams({ language: 'am' })).toBe('am')
    expect(langFromJobParams({ lang: 'en' })).toBe('en')
  })

  it('rejects unsupported languages without retry', () => {
    expect(() => langFromJobParams({ language: 'fr' })).toThrow(
      expect.objectContaining({ name: 'JobError', retryable: false }),
    )
  })
})

describe('markNeedsReview', () => {
  it('forces needsReview on every cue', () => {
    const cues = markNeedsReview([
      { id: 'a', start: 0, end: 1, text: 'hi', needsReview: false },
      { start: 1, end: 2, text: 'there' },
    ])
    expect(cues.every((c) => c.needsReview === true)).toBe(true)
    expect(cues[1]?.id).toBe('cue-2')
  })
})

describe('transcribeStoredAudio', () => {
  it('uploads WebVTT with needsReview cues', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abolkit-stt-'))
    const storage = createLocalDiskStorage({
      root: join(root, 'store'),
      signingSecret: 'secret',
    })
    const assetId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    await storage.put(audio16kKey(assetId), new Uint8Array([1, 2, 3]), 'audio/mpeg')

    const result = await transcribeStoredAudio({
      storage,
      transcriber: createStubTranscriber(),
      assetId,
      lang: 'en',
      workDir: join(root, 'work'),
      log: () => {},
    })

    expect(result).toMatchObject({
      captionsKey: `assets/${assetId}/captions/en.vtt`,
      cueCount: 1,
      needsReview: true,
      transcriber: 'stub',
    })

    const object = await storage.get(result.captionsKey)
    const cues = parseVtt(new TextDecoder().decode(object!.bytes))
    expect(cues[0]?.needsReview).toBe(true)
    expect(cues[0]?.text).toContain('stub transcript')
  })

  it('maps unreachable provider errors to retryable JobError', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abolkit-stt-fail-'))
    const storage = createLocalDiskStorage({
      root: join(root, 'store'),
      signingSecret: 'secret',
    })
    const assetId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    await storage.put(audio16kKey(assetId), new Uint8Array([1]), 'audio/mpeg')

    const broken: Transcriber = {
      id: 'broken',
      label: 'broken',
      sendsDataOffHost: false,
      async transcribe() {
        throw new ProviderError('UNREACHABLE', 'MMS down')
      },
    }

    await expect(
      transcribeStoredAudio({
        storage,
        transcriber: broken,
        assetId,
        lang: 'en',
        workDir: join(root, 'work'),
      }),
    ).rejects.toMatchObject({
      name: 'JobError',
      retryable: true,
      message: 'MMS down',
    } satisfies Partial<JobError>)
  })

  it('does not retry client errors from the provider', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abolkit-stt-4xx-'))
    const storage = createLocalDiskStorage({
      root: join(root, 'store'),
      signingSecret: 'secret',
    })
    const assetId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    await storage.put(audio16kKey(assetId), new Uint8Array([1]), 'audio/mpeg')

    const rejecting: Transcriber = {
      id: 'rejecting',
      label: 'rejecting',
      sendsDataOffHost: false,
      async transcribe() {
        throw new ProviderError('HTTP_ERROR', 'MMS wrapper HTTP 400', 400)
      },
    }

    await expect(
      transcribeStoredAudio({
        storage,
        transcriber: rejecting,
        assetId,
        lang: 'en',
        workDir: join(root, 'work'),
      }),
    ).rejects.toMatchObject({ name: 'JobError', retryable: false })
  })
})
