import { enqueueJob, getJob, JobError, migrateJobs, openSqlite } from '@abolkit/jobs'
import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'

import { createDefaultHandlers } from './handlers.ts'
import { createJobRunner, type JobHandlers } from './runner.ts'

const ASSET = '11111111-1111-4111-8111-111111111111'

let db: DatabaseSync
let now: Date

beforeEach(() => {
  db = openSqlite(':memory:')
  migrateJobs(db)
  now = new Date('2026-11-15T00:00:00.000Z')
})

function runner(handlers: JobHandlers) {
  return createJobRunner({
    db,
    handlers,
    leaseSeconds: 60,
    pollIntervalMs: 10,
    backoff: { baseMs: 1000, maxMs: 10_000 },
    clock: () => now,
    log: () => {},
  })
}

const advance = (ms: number) => {
  now = new Date(now.getTime() + ms)
}

describe('job runner', () => {
  it('runs a handler, records progress and the result', async () => {
    const job = enqueueJob(db, { assetId: ASSET, type: 'transcribe', maxAttempts: 3, now })
    const seen: number[] = []

    const after = await runner({
      transcribe: async (claimed, ctx) => {
        expect(claimed.id).toBe(job.id)
        ctx.progress(50)
        seen.push(getJob(db, job.id)!.progress)
        return { captions: `lessons/${claimed.assetId}/captions/am.vtt` }
      },
    }).runOnce()

    expect(seen).toEqual([50])
    expect(after).toMatchObject({
      status: 'succeeded',
      progress: 100,
      attempts: 1,
      result: { captions: `lessons/${ASSET}/captions/am.vtt` },
    })
  })

  it('retries a failing handler with backoff, then succeeds', async () => {
    enqueueJob(db, { assetId: ASSET, type: 'transcribe', maxAttempts: 3, now })
    let calls = 0
    const r = runner({
      transcribe: async () => {
        calls += 1
        if (calls === 1) throw new Error('MMS service unreachable')
        return { ok: true }
      },
    })

    const first = await r.runOnce()
    expect(first).toMatchObject({ status: 'queued', attempts: 1, error: 'MMS service unreachable' })

    expect(await r.runOnce()).toBeNull()
    advance(1000)
    const second = await r.runOnce()
    expect(second).toMatchObject({ status: 'succeeded', attempts: 2, error: null })
  })

  it('fails after max attempts', async () => {
    enqueueJob(db, { assetId: ASSET, type: 'transcribe', maxAttempts: 2, now })
    const r = runner({
      transcribe: async () => {
        throw new Error('boom')
      },
    })

    await r.runOnce()
    advance(1000)
    const last = await r.runOnce()
    expect(last).toMatchObject({ status: 'failed', attempts: 2, error: 'boom' })
  })

  it('does not retry non-retryable errors', async () => {
    enqueueJob(db, { assetId: ASSET, type: 'transcribe', maxAttempts: 3, now })
    const after = await runner({
      transcribe: async () => {
        throw new JobError('unsupported language', { retryable: false })
      },
    }).runOnce()
    expect(after).toMatchObject({ status: 'failed', attempts: 1 })
  })

  it('default handlers fail unimplemented types once with a clear error', async () => {
    enqueueJob(db, { assetId: ASSET, type: 'offline-pack', maxAttempts: 3, now })
    const after = await runner(createDefaultHandlers()).runOnce()
    expect(after?.status).toBe('failed')
    expect(after?.attempts).toBe(1)
    expect(after?.error).toMatch(/not implemented/)
  })

  it('transcribe stays unimplemented until storage is wired for ffmpeg', async () => {
    enqueueJob(db, { assetId: ASSET, type: 'transcribe', maxAttempts: 1, now })
    const after = await runner(createDefaultHandlers()).runOnce()
    expect(after?.status).toBe('failed')
    expect(after?.error).toMatch(/#27/)
  })

  it('start() polls until stop()', async () => {
    const job = enqueueJob(db, { assetId: ASSET, type: 'transcribe', maxAttempts: 1, now })
    const r = runner({ transcribe: async () => ({ ok: true }) })

    const loop = r.start()
    for (let i = 0; i < 50 && getJob(db, job.id)?.status !== 'succeeded'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    await r.stop()
    await loop
    expect(getJob(db, job.id)?.status).toBe('succeeded')
  })
})
