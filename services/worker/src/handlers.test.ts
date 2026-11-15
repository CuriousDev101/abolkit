import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { enqueueJob, getJob, migrateJobs, openSqlite } from '@abolkit/jobs'
import { createLocalDiskStorage } from '@abolkit/provider-sdk'
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

describe('transcribe handler (ffmpeg #26)', () => {
  it('produces extract + renditions and records the size report on the job', async () => {
    const store = createLocalDiskStorage({
      root: join(root, 'storage'),
      signingSecret: 'test-signing-secret',
    })
    await store.put(sourceKey(ASSET), new Uint8Array([9, 9, 9]), 'video/mp4')

    const job = enqueueJob(db, { assetId: ASSET, type: 'transcribe', maxAttempts: 2, now })
    const runner = createJobRunner({
      db,
      handlers: createDefaultHandlers({
        storage: store,
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
      stt: 'pending-#27',
      audio16kKey: `assets/${ASSET}/audio/16k-mono.mp3`,
      opusAudioKey: `assets/${ASSET}/renditions/audio.opus`,
      video240pKey: `assets/${ASSET}/renditions/video-240p.mp4`,
    })
    const sizes = (getJob(db, job.id)?.result as { sizes?: { totalBytes?: number } } | null)?.sizes
    expect(sizes?.totalBytes).toBeGreaterThan(0)
  })
})
