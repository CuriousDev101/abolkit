// DB-backed job queue (#25, ADR 0005): the API enqueues rows, the worker claims
// them with a lease, reports progress, and completes or fails with retry.

export { JobError, isRetryable } from './errors.ts'
export {
  JOB_STATUSES,
  JOB_TYPES,
  backoffMs,
  claimNextJob,
  completeJob,
  enqueueJob,
  failJob,
  getJob,
  isJobType,
  migrateJobs,
  renewLease,
  reportProgress,
  type BackoffOptions,
  type Job,
  type JobAttempt,
  type JobStatus,
  type JobType,
  type JsonObject,
} from './queue.ts'
export { openSqlite, sqlitePathFromUrl } from './sqlite.ts'
