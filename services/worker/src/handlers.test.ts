import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parseVtt } from '@abolkit/core'
import { enqueueJob, getJob, migrateJobs, openSqlite } from '@abolkit/jobs'
import { createLocalDiskStorage, createStubTranscriber } from '@abolkit/provider-sdk'
import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'

import { createDefaultHandlers } from './handlers.ts'
import { sourceKey } from './ffmpeg/keys.ts'
import { createJobRunner } from './runner.ts'

const ASSET = '33333333-3333-4333-8333-333333333333'

let db: DatabaseSync
let now: Date
let root: string

beforeEach(async () => {
  db = openSqlite(':memory:')
  migrateJobs(db)
  now = new Date('2026-11-15T00:00:00.000Z')
  root = await mkdtemp(join(tmpdir(), 'abolkit-handler-'))
})

describe('transcribe handler (#26 + #27)', () => {
  it('produces media, runs STT, and stores needsReview captions', async () => {
    const store = createLocalDiskStorage({
      root: join(root, 'storage'),
      signingSecret: 'test-signing-secret',
    })
    await store.put(sourceKey(ASSET), new Uint8Array([9, 9, 9]), 'video/mp4')

    const job = enqueueJob(db, {
      assetId: ASSET,
      type: 'transcribe',
      params: { language: 'am' },
      maxAttempts: 2,
      now,
    })
    const runner = createJobRunner({
      db,
      handlers: createDefaultHandlers({
        storage: store,
        transcriber: createStubTranscriber(),
        workDir: join(root, 'work'),
        runFfmpeg: async (args) => {
          await writeFile(args[args.length - 1]!, Buffer.from('x'))
        },
        log: () => {},
      }),
      leaseSeconds: 60,
      pollIntervalMs: 10,
      clock: () => now,
      log: () => {},
    })

    const after = await runner.runOnce()
    expect(after?.status).toBe('succeeded')
    expect(after?.result).toMatchObject({
      audio16kKey: `assets/${ASSET}/audio/16k-mono.mp3`,
      opusAudioKey: `assets/${ASSET}/renditions/audio.opus`,
      video240pKey: `assets/${ASSET}/renditions/video-240p.mp4`,
      lang: 'am',
      captionsKey: `assets/${ASSET}/captions/am.vtt`,
      cueCount: 1,
      needsReview: true,
      transcriber: 'stub',
      sendsDataOffHost: false,
    })
    const sizes = (getJob(db, job.id)?.result as { sizes?: { totalBytes?: number } } | null)?.sizes
    expect(sizes?.totalBytes).toBeGreaterThan(0)

    const captions = await store.get(`assets/${ASSET}/captions/am.vtt`)
    expect(captions).not.toBeNull()
    const cues = parseVtt(new TextDecoder().decode(captions!.bytes))
    expect(cues).toHaveLength(1)
    expect(cues[0]?.needsReview).toBe(true)
  })
})

describe('offline-pack handler (#35)', () => {
  it('builds a zip and stores totalBytes on the job result', async () => {
    const store = createLocalDiskStorage({
      root: join(root, 'storage'),
      signingSecret: 'test-signing-secret',
    })
    await store.put(
      `assets/${ASSET}/renditions/audio.opus`,
      new Uint8Array([1, 2, 3]),
      'audio/opus',
    )
    await store.put(
      `assets/${ASSET}/captions/en.vtt`,
      new TextEncoder().encode('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n'),
      'text/vtt',
    )

    const job = enqueueJob(db, {
      assetId: ASSET,
      type: 'offline-pack',
      params: { title: 'Pack demo', lang: 'en', langs: ['en'] },
      maxAttempts: 2,
      now,
    })
    const runner = createJobRunner({
      db,
      handlers: createDefaultHandlers({
        storage: store,
        log: () => {},
      }),
      leaseSeconds: 60,
      pollIntervalMs: 10,
      clock: () => now,
      log: () => {},
    })

    const after = await runner.runOnce()
    expect(after?.status).toBe('succeeded')
    expect(after?.result).toMatchObject({
      packKey: `assets/${ASSET}/packs/offline.zip`,
      audioFile: 'lesson.opus',
      transcriptFile: 'transcript.html',
      captionFiles: ['captions.en.vtt'],
      descriptionFiles: [],
      brailleFile: null,
      brailleExperimental: false,
      videoFile: null,
    })
    const totalBytes = (getJob(db, job.id)?.result as { totalBytes?: number } | null)?.totalBytes
    expect(totalBytes).toBeGreaterThan(0)
    expect(await store.get(`assets/${ASSET}/packs/offline.zip`)).not.toBeNull()
  })
})
