// API process config. Speech-to-text is not configured here: the worker calls the
// external MMS wrapper (services/worker, TRANSCRIBER_URL). URL caption settings
// (POSTGRES_URL, REDIS_URL, CAPTION_*, RATE_LIMIT_*) are read by @abolkit/caption-store.

import { storageConfigFromEnv } from '@abolkit/provider-sdk'

type Env = Record<string, string | undefined>

const DEFAULT_ALLOWED_MIME = [
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/opus',
  'application/octet-stream',
] as const

export type ApiConfig = {
  port: number
  /** Bind address. `127.0.0.1` by default; `0.0.0.0` in a container. */
  host: string
  /** `*` or one origin. Read routes stay open so a host page can call them. */
  corsOrigin: string
  /**
   * Shared secret for write routes (#24+). Reads never require it.
   * Empty means writes must refuse until configured.
   */
  apiKey: string | undefined
  /**
   * Absolute or relative SQLite URL/path for legacy asset uploads (ADR 0005).
   * Empty: asset routes are off; URL captions use Postgres instead (ADR 0007).
   */
  databaseUrl: string | undefined
  /** `local-disk` (default for no-Docker) or `minio` (Compose). */
  storageProvider: string
  /** Origin embedded in local-disk signed URLs. */
  publicBaseUrl: string | undefined
  /** Max upload size in bytes. */
  assetMaxBytes: number
  /** Allowed Content-Types for POST /api/assets. */
  assetAllowedMime: readonly string[]
  /** Default retention when the client omits retentionDays. */
  assetRetentionDays: number
  /** TTL for downloadUrl on GET /api/assets/:id. */
  signedUrlTtlSeconds: number
  /** Attempts (first run + retries) stored on each new job. */
  jobMaxAttempts: number
  /** Raw env forwarded to createStorage. */
  env: Env
}

export function loadApiConfig(env: Env = process.env as Env): ApiConfig {
  const port = Number(env.PORT ?? 8787)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT must be an integer from 0 to 65535, got ${env.PORT}`)
  }

  const apiKey = env.API_KEY?.trim()
  const assetMaxBytes = parsePositiveInt(env.ASSET_MAX_BYTES, 100 * 1024 * 1024, 'ASSET_MAX_BYTES')
  const assetRetentionDays = parsePositiveInt(env.ASSET_RETENTION_DAYS, 7, 'ASSET_RETENTION_DAYS')
  const signedUrlTtlSeconds = parsePositiveInt(
    env.SIGNED_URL_TTL_SECONDS,
    3600,
    'SIGNED_URL_TTL_SECONDS',
  )
  const jobMaxAttempts = parsePositiveInt(env.JOB_MAX_ATTEMPTS, 3, 'JOB_MAX_ATTEMPTS')

  const allowed = env.ASSET_ALLOWED_MIME?.split(',')
    .map((part) => part.trim())
    .filter(Boolean) ?? [...DEFAULT_ALLOWED_MIME]

  const host = env.HOST?.trim() || '127.0.0.1'

  return {
    port,
    host,
    corsOrigin: env.CORS_ORIGIN ?? '*',
    apiKey: apiKey || undefined,
    databaseUrl: env.DATABASE_URL?.trim() || undefined,
    storageProvider: storageConfigFromEnv(env).storage,
    publicBaseUrl: env.PUBLIC_BASE_URL?.trim() || undefined,
    assetMaxBytes,
    assetAllowedMime: allowed,
    assetRetentionDays,
    signedUrlTtlSeconds,
    jobMaxAttempts,
    env,
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
