import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  storageConfigFromEnv,
  transcriberConfigFromEnv,
  type ProviderConfig,
} from '@abolkit/provider-sdk'

type Env = Record<string, string | undefined>

export type WorkerProviderConfig = Pick<
  ProviderConfig,
  'transcriber' | 'transcriberUrl' | 'translator' | 'tts' | 'storage'
> & {
  /** Temp parent dir for ffmpeg work folders. */
  workDir: string
  /** Optional absolute path to the ffmpeg binary. */
  ffmpegBin: string | undefined
}

export function loadWorkerConfig(env: Env = process.env as Env): WorkerProviderConfig {
  return {
    ...transcriberConfigFromEnv(env),
    ...storageConfigFromEnv(env),
    translator: env.TRANSLATOR ?? 'none',
    tts: env.TTS ?? 'recorded-clips',
    workDir: env.WORKER_WORK_DIR?.trim() || join(tmpdir(), 'abolkit-worker'),
    ffmpegBin: env.FFMPEG_BIN?.trim() || undefined,
  }
}

export type QueueConfig = {
  /** Must be the same SQLite file the API writes (ADR 0005). */
  databaseUrl: string
  pollIntervalMs: number
  leaseSeconds: number
  retryBaseMs: number
  retryMaxMs: number
}

export function loadQueueConfig(env: Env = process.env as Env): QueueConfig {
  const databaseUrl = env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required and must point at the API SQLite file (e.g. file:../api/data/abolkit.sqlite)',
    )
  }
  return {
    databaseUrl,
    pollIntervalMs: parsePositiveInt(env.JOB_POLL_INTERVAL_MS, 1500, 'JOB_POLL_INTERVAL_MS'),
    leaseSeconds: parsePositiveInt(env.JOB_LEASE_SECONDS, 120, 'JOB_LEASE_SECONDS'),
    retryBaseMs: parsePositiveInt(env.JOB_RETRY_BASE_MS, 2000, 'JOB_RETRY_BASE_MS'),
    retryMaxMs: parsePositiveInt(env.JOB_RETRY_MAX_MS, 60_000, 'JOB_RETRY_MAX_MS'),
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw == null || raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer, got ${raw}`)
  }
  return n
}
