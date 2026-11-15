import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

export const JOB_TYPES = ['transcribe', 'translate', 'describe-tts', 'offline-pack'] as const
export type JobType = (typeof JOB_TYPES)[number]

export const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export type JsonObject = { [key: string]: unknown }

export type Job = {
  id: string
  assetId: string
  type: JobType
  status: JobStatus
  /** 0–100. */
  progress: number
  /** Attempts started so far, including the running one. */
  attempts: number
  maxAttempts: number
  /** Last failure message. Kept while a retry is queued. */
  error: string | null
  params: JsonObject
  result: JsonObject | null
  /** Earliest time a queued job may be claimed (retry backoff). */
  runAfter: string
  /** Lease held by the worker running this job. Null unless running. */
  leasedUntil: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  finishedAt: string | null
}

/** Identifies one attempt. Writes from a worker whose lease was taken over are ignored. */
export type JobAttempt = Pick<Job, 'id' | 'attempts'>

type JobDbRow = {
  id: string
  asset_id: string
  type: string
  status: string
  progress: number | bigint
  attempts: number | bigint
  max_attempts: number | bigint
  error: string | null
  params_json: string
  result_json: string | null
  run_after: string
  leased_until: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  finished_at: string | null
}

export function isJobType(value: unknown): value is JobType {
  return typeof value === 'string' && (JOB_TYPES as readonly string[]).includes(value)
}

// No foreign key to assets: the worker may create this table before the API
// has created `assets`, and asset retention cleanup must not be blocked by jobs.
export function migrateJobs(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY NOT NULL,
      asset_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL CHECK (max_attempts >= 1),
      error TEXT,
      params_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT,
      run_after TEXT NOT NULL,
      leased_until TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT
    );
    CREATE INDEX IF NOT EXISTS jobs_claim_idx ON jobs (status, run_after, created_at);
    CREATE INDEX IF NOT EXISTS jobs_asset_id_idx ON jobs (asset_id);
  `)
}

export function enqueueJob(
  db: DatabaseSync,
  input: {
    assetId: string
    type: JobType
    params?: JsonObject
    maxAttempts: number
    id?: string
    now?: Date
  },
): Job {
  if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1) {
    throw new Error(`maxAttempts must be a positive integer, got ${input.maxAttempts}`)
  }
  const id = input.id ?? randomUUID()
  const now = (input.now ?? new Date()).toISOString()

  db.prepare(
    `INSERT INTO jobs (
      id, asset_id, type, status, progress, attempts, max_attempts,
      params_json, run_after, created_at, updated_at
    ) VALUES (?, ?, ?, 'queued', 0, 0, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.assetId,
    input.type,
    input.maxAttempts,
    JSON.stringify(input.params ?? {}),
    now,
    now,
    now,
  )

  return getJob(db, id)!
}

export function getJob(db: DatabaseSync, id: string): Job | null {
  const row = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as JobDbRow | undefined
  return row ? mapRow(row) : null
}

/**
 * Atomically claim the oldest runnable job: a queued job whose backoff has
 * elapsed, or a running job whose lease expired (its worker died). Expired
 * jobs with no attempts left are marked failed instead of being reclaimed.
 */
export function claimNextJob(
  db: DatabaseSync,
  options: { leaseSeconds: number; types?: readonly JobType[]; now?: Date },
): Job | null {
  const nowDate = options.now ?? new Date()
  const now = nowDate.toISOString()
  const leasedUntil = new Date(nowDate.getTime() + options.leaseSeconds * 1000).toISOString()
  const types = options.types ?? JOB_TYPES
  if (types.length === 0) return null
  const typePlaceholders = types.map(() => '?').join(', ')

  return transaction(db, () => {
    db.prepare(
      `UPDATE jobs
       SET status = 'failed', leased_until = NULL, finished_at = ?, updated_at = ?,
           error = COALESCE(error, 'Worker lease expired') || ' (no attempts left)'
       WHERE status = 'running' AND leased_until <= ? AND attempts >= max_attempts`,
    ).run(now, now, now)

    const row = db
      .prepare(
        `UPDATE jobs
         SET status = 'running', attempts = attempts + 1, leased_until = ?,
             started_at = COALESCE(started_at, ?), updated_at = ?
         WHERE id = (
           SELECT id FROM jobs
           WHERE type IN (${typePlaceholders})
             AND ((status = 'queued' AND run_after <= ?) OR (status = 'running' AND leased_until <= ?))
           ORDER BY run_after, created_at
           LIMIT 1
         )
         RETURNING *`,
      )
      .get(leasedUntil, now, now, ...types, now, now) as JobDbRow | undefined

    return row ? mapRow(row) : null
  })
}

/** Update progress and extend the lease. Returns false if this attempt no longer owns the job. */
export function reportProgress(
  db: DatabaseSync,
  attempt: JobAttempt,
  progress: number,
  options: { leaseSeconds: number; now?: Date },
): boolean {
  const nowDate = options.now ?? new Date()
  const leasedUntil = new Date(nowDate.getTime() + options.leaseSeconds * 1000).toISOString()
  const clamped = Math.min(100, Math.max(0, Math.round(progress)))
  const changes = db
    .prepare(
      `UPDATE jobs SET progress = MAX(progress, ?), leased_until = ?, updated_at = ?
       WHERE id = ? AND attempts = ? AND status = 'running'`,
    )
    .run(clamped, leasedUntil, nowDate.toISOString(), attempt.id, attempt.attempts).changes
  return Number(changes) > 0
}

/** Extend the lease without changing progress. */
export function renewLease(
  db: DatabaseSync,
  attempt: JobAttempt,
  options: { leaseSeconds: number; now?: Date },
): boolean {
  return reportProgress(db, attempt, 0, options)
}

export function completeJob(
  db: DatabaseSync,
  attempt: JobAttempt,
  result: JsonObject | null = null,
  options: { now?: Date } = {},
): boolean {
  const now = (options.now ?? new Date()).toISOString()
  const changes = db
    .prepare(
      `UPDATE jobs
       SET status = 'succeeded', progress = 100, error = NULL, result_json = ?,
           leased_until = NULL, finished_at = ?, updated_at = ?
       WHERE id = ? AND attempts = ? AND status = 'running'`,
    )
    .run(
      result == null ? null : JSON.stringify(result),
      now,
      now,
      attempt.id,
      attempt.attempts,
    ).changes
  return Number(changes) > 0
}

/**
 * Record a failed attempt. Retryable failures go back to `queued` with
 * exponential backoff until `maxAttempts` is reached; then the job is `failed`.
 */
export function failJob(
  db: DatabaseSync,
  attempt: JobAttempt,
  message: string,
  options: { retryable?: boolean; backoff?: BackoffOptions; now?: Date } = {},
): Job | null {
  const nowDate = options.now ?? new Date()
  const now = nowDate.toISOString()
  const retryable = options.retryable ?? true

  return transaction(db, () => {
    const current = getJob(db, attempt.id)
    if (!current || current.status !== 'running' || current.attempts !== attempt.attempts) {
      return null
    }

    if (retryable && current.attempts < current.maxAttempts) {
      const runAfter = new Date(
        nowDate.getTime() + backoffMs(current.attempts, options.backoff),
      ).toISOString()
      db.prepare(
        `UPDATE jobs
         SET status = 'queued', error = ?, run_after = ?, leased_until = NULL, updated_at = ?
         WHERE id = ?`,
      ).run(message, runAfter, now, attempt.id)
    } else {
      db.prepare(
        `UPDATE jobs
         SET status = 'failed', error = ?, leased_until = NULL, finished_at = ?, updated_at = ?
         WHERE id = ?`,
      ).run(message, now, now, attempt.id)
    }
    return getJob(db, attempt.id)
  })
}

export type BackoffOptions = { baseMs?: number; maxMs?: number }

/** Delay before the next attempt after `attemptsSoFar` failures: base * 2^(n-1), capped. */
export function backoffMs(attemptsSoFar: number, options: BackoffOptions = {}): number {
  const base = options.baseMs ?? 2000
  const max = options.maxMs ?? 60_000
  const exponent = Math.max(0, attemptsSoFar - 1)
  return Math.min(max, base * 2 ** exponent)
}

function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const value = fn()
    db.exec('COMMIT')
    return value
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

function mapRow(row: JobDbRow): Job {
  return {
    id: row.id,
    assetId: row.asset_id,
    type: row.type as JobType,
    status: row.status as JobStatus,
    progress: Number(row.progress),
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    error: row.error,
    params: JSON.parse(row.params_json) as JsonObject,
    result: row.result_json == null ? null : (JSON.parse(row.result_json) as JsonObject),
    runAfter: row.run_after,
    leasedUntil: row.leased_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}
