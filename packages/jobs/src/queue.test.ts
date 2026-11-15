import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  backoffMs,
  claimNextJob,
  completeJob,
  enqueueJob,
  failJob,
  getJob,
  migrateJobs,
  reportProgress,
} from './queue.ts'
import { openSqlite } from './sqlite.ts'

const ASSET = '11111111-1111-4111-8111-111111111111'
const T0 = new Date('2026-11-15T00:00:00.000Z')
const at = (ms: number) => new Date(T0.getTime() + ms)

let db: DatabaseSync

beforeEach(() => {
  db = openSqlite(':memory:')
  migrateJobs(db)
})

describe('enqueue and claim', () => {
  it('enqueues a queued job with zero progress', () => {
    const job = enqueueJob(db, { assetId: ASSET, type: 'transcribe', maxAttempts: 3, now: T0 })
    expect(job).toMatchObject({
      assetId: ASSET,
      type: 'transcribe',
      status: 'queued',
      progress: 0,
      attempts: 0,
      maxAttempts: 3,
      error: null,
      result: null,
      params: {},
    })
    expect(getJob(db, job.id)).toEqual(job)
  })

  it('claims the oldest job once and leases it', () => {
    const first = enqueueJob(db, { assetId: ASSET, type: 'transcribe', maxAttempts: 3, now: T0 })
    enqueueJob(db, { assetId: ASSET, type: 'translate', maxAttempts: 3, now: at(1) })

    const claimed = claimNextJob(db, { leaseSeconds: 60, now: at(10) })
    expect(claimed).toMatchObject({ id: first.id, status: 'running', attempts: 1 })
    expect(claimed?.leasedUntil).toBe(at(10 + 60_000).toISOString())
    expect(claimed?.startedAt).toBe(at(10).toISOString())

    const second = claimNextJob(db, { leaseSeconds: 60, now: at(10) })
    expect(second?.type).toBe('translate')
    expect(claimNextJob(db, { leaseSeconds: 60, now: at(10) })).toBeNull()
  })

  it('only claims requested types', () => {
    enqueueJob(db, { assetId: ASSET, type: 'offline-pack', maxAttempts: 1, now: T0 })
    expect(claimNextJob(db, { leaseSeconds: 60, types: ['transcribe'], now: T0 })).toBeNull()
  })
})

describe('progress and completion', () => {
  it('records monotonic, clamped progress and completes with a result', () => {
    enqueueJob(db, { assetId: ASSET, type: 'transcribe', maxAttempts: 3, now: T0 })
    const job = claimNextJob(db, { leaseSeconds: 60, now: T0 })!

    expect(reportProgress(db, job, 40, { leaseSeconds: 60, now: at(1000) })).toBe(true)
    reportProgress(db, job, 20, { leaseSeconds: 60, now: at(2000) })
    expect(getJob(db, job.id)?.progress).toBe(40)
    reportProgress(db, job, 250, { leaseSeconds: 60, now: at(3000) })
    expect(getJob(db, job.id)?.progress).toBe(100)

    expect(completeJob(db, job, { vtt: 'lessons/x/captions/en.vtt' }, { now: at(4000) })).toBe(true)
    expect(getJob(db, job.id)).toMatchObject({
      status: 'succeeded',
      progress: 100,
      result: { vtt: 'lessons/x/captions/en.vtt' },
      leasedUntil: null,
      finishedAt: at(4000).toISOString(),
    })
  })
})

describe('retry', () => {
  it('requeues with backoff, then fails after maxAttempts', () => {
    enqueueJob(db, { assetId: ASSET, type: 'transcribe', maxAttempts: 2, now: T0 })
    const backoff = { baseMs: 1000, maxMs: 10_000 }

    const a1 = claimNextJob(db, { leaseSeconds: 60, now: T0 })!
    const afterFirst = failJob(db, a1, 'STT timeout', { backoff, now: at(100) })
    expect(afterFirst).toMatchObject({ status: 'queued', attempts: 1, error: 'STT timeout' })
    expect(afterFirst?.runAfter).toBe(at(1100).toISOString())

    expect(claimNextJob(db, { leaseSeconds: 60, now: at(1099) })).toBeNull()
    const a2 = claimNextJob(db, { leaseSeconds: 60, now: at(1100) })!
    expect(a2.attempts).toBe(2)

    const afterSecond = failJob(db, a2, 'STT timeout again', { backoff, now: at(1200) })
    expect(afterSecond).toMatchObject({
      status: 'failed',
      attempts: 2,
      error: 'STT timeout again',
      finishedAt: at(1200).toISOString(),
    })
    expect(claimNextJob(db, { leaseSeconds: 60, now: at(999_999) })).toBeNull()
  })

  it('fails immediately when the error is not retryable', () => {
    enqueueJob(db, { assetId: ASSET, type: 'transcribe', maxAttempts: 3, now: T0 })
    const job = claimNextJob(db, { leaseSeconds: 60, now: T0 })!
    expect(failJob(db, job, 'bad input', { retryable: false, now: at(1) })).toMatchObject({
      status: 'failed',
      attempts: 1,
    })
  })

  it('backoff doubles and caps', () => {
    expect([1, 2, 3, 4].map((n) => backoffMs(n, { baseMs: 1000, maxMs: 5000 }))).toEqual([
      1000, 2000, 4000, 5000,
    ])
  })
})

describe('lease expiry', () => {
  it('reclaims a job whose worker died and ignores the stale worker', () => {
    enqueueJob(db, { assetId: ASSET, type: 'transcribe', maxAttempts: 3, now: T0 })
    const stale = claimNextJob(db, { leaseSeconds: 10, now: T0 })!

    expect(claimNextJob(db, { leaseSeconds: 10, now: at(9_999) })).toBeNull()
    const fresh = claimNextJob(db, { leaseSeconds: 10, now: at(10_000) })!
    expect(fresh).toMatchObject({ id: stale.id, attempts: 2, status: 'running' })

    expect(reportProgress(db, stale, 50, { leaseSeconds: 10, now: at(10_001) })).toBe(false)
    expect(completeJob(db, stale, null, { now: at(10_002) })).toBe(false)
    expect(failJob(db, stale, 'late', { now: at(10_003) })).toBeNull()
    expect(getJob(db, stale.id)?.status).toBe('running')
  })

  it('fails an expired job that has no attempts left', () => {
    enqueueJob(db, { assetId: ASSET, type: 'transcribe', maxAttempts: 1, now: T0 })
    const job = claimNextJob(db, { leaseSeconds: 10, now: T0 })!

    expect(claimNextJob(db, { leaseSeconds: 10, now: at(10_000) })).toBeNull()
    expect(getJob(db, job.id)).toMatchObject({
      status: 'failed',
      attempts: 1,
      error: 'Worker lease expired (no attempts left)',
    })
  })
})
