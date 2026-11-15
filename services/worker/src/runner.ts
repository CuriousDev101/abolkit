import {
  claimNextJob,
  completeJob,
  failJob,
  getJob,
  isRetryable,
  renewLease,
  reportProgress,
  type BackoffOptions,
  type Job,
  type JobType,
  type JsonObject,
} from '@abolkit/jobs'
import type { DatabaseSync } from 'node:sqlite'

export type JobContext = {
  /** 0–100. Also renews the lease. */
  progress(value: number): void
  /** Aborted when this worker loses the lease or is stopping. */
  signal: AbortSignal
}

export type JobHandler = (job: Job, ctx: JobContext) => Promise<JsonObject | null | void>

export type JobHandlers = Partial<Record<JobType, JobHandler>>

export type Logger = (event: Record<string, unknown>) => void

export type JobRunnerOptions = {
  db: DatabaseSync
  handlers: JobHandlers
  leaseSeconds: number
  pollIntervalMs: number
  backoff?: BackoffOptions
  clock?: () => Date
  log?: Logger
}

export type JobRunner = {
  /** Claim and run at most one job. Returns the job's state afterwards, or null if none was runnable. */
  runOnce(): Promise<Job | null>
  /** Poll until stop() is called. */
  start(): Promise<void>
  /** Stop polling and wait for the current job to finish. */
  stop(): Promise<void>
}

export function createJobRunner(options: JobRunnerOptions): JobRunner {
  const { db, handlers, leaseSeconds, pollIntervalMs } = options
  const clock = options.clock ?? (() => new Date())
  const log: Logger = options.log ?? ((event) => console.log(JSON.stringify(event)))
  const types = Object.keys(handlers) as JobType[]
  const stopController = new AbortController()
  let loop: Promise<void> | null = null

  async function runOnce(): Promise<Job | null> {
    const job = claimNextJob(db, { leaseSeconds, types, now: clock() })
    if (!job) return null

    const handler = handlers[job.type]!
    const attempt = { id: job.id, attempts: job.attempts }
    const lease = new AbortController()
    const onStop = () => lease.abort(new Error('Worker stopping'))
    stopController.signal.addEventListener('abort', onStop, { once: true })

    const heartbeat = setInterval(
      () => {
        if (!renewLease(db, attempt, { leaseSeconds, now: clock() })) {
          lease.abort(new Error('Lease lost'))
        }
      },
      Math.max(1000, (leaseSeconds * 1000) / 3),
    )

    log({ event: 'job.started', jobId: job.id, type: job.type, attempt: job.attempts })
    try {
      const result = await handler(job, {
        signal: lease.signal,
        progress(value) {
          if (!reportProgress(db, attempt, value, { leaseSeconds, now: clock() })) {
            lease.abort(new Error('Lease lost'))
          }
        },
      })
      if (!completeJob(db, attempt, result ?? null, { now: clock() })) {
        log({ event: 'job.lease_lost', jobId: job.id, attempt: job.attempts })
        return null
      }
      log({ event: 'job.succeeded', jobId: job.id, type: job.type, attempt: job.attempts })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      const after = failJob(db, attempt, message, {
        retryable: isRetryable(err),
        backoff: options.backoff,
        now: clock(),
      })
      if (!after) {
        log({ event: 'job.lease_lost', jobId: job.id, attempt: job.attempts })
        return null
      }
      log({
        event: after.status === 'queued' ? 'job.retry_scheduled' : 'job.failed',
        jobId: job.id,
        type: job.type,
        attempt: job.attempts,
        maxAttempts: job.maxAttempts,
        error: message,
        nextAttemptAt: after.status === 'queued' ? after.runAfter : null,
      })
    } finally {
      clearInterval(heartbeat)
      stopController.signal.removeEventListener('abort', onStop)
    }

    return getJob(db, job.id)
  }

  async function poll(): Promise<void> {
    while (!stopController.signal.aborted) {
      let ran = false
      try {
        ran = (await runOnce()) !== null
      } catch (err: unknown) {
        log({ event: 'worker.error', error: err instanceof Error ? err.message : String(err) })
      }
      if (!ran) await sleep(pollIntervalMs, stopController.signal)
    }
  }

  return {
    runOnce,
    start() {
      loop ??= poll()
      return loop
    },
    async stop() {
      stopController.abort()
      await loop
    },
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
  })
}
