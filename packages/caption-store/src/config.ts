type Env = Record<string, string | undefined>

export interface CaptionConfig {
  postgresUrl: string
  redisUrl: string
  /** Prefix for BullMQ and cache keys, so several deployments can share one Redis. */
  redisPrefix: string
  /** Hosts the worker may download from (plus subdomains). `*` allows any http(s) URL. */
  allowedHosts: string[]
  /** Languages the translate endpoints accept. */
  translationLanguages: string[]
  /** Spoken language when the request omits `sourceLanguage` (always English unless the host overrides). */
  defaultSourceLanguage: string
  /** Longer videos are refused before any audio is downloaded. */
  maxDurationSeconds: number
  cacheTtlSeconds: number
  jobAttempts: number
  jobBackoffMs: number
  transcribeConcurrency: number
  translateConcurrency: number
  rateLimit: {
    windowSeconds: number
    /** POST requests that can start jobs, per IP per window. */
    jobRequests: number
    /** GET requests, per IP per window. */
    readRequests: number
    /** Read the client IP from X-Forwarded-For (only behind a proxy you control). */
    trustProxy: boolean
  }
}

export const DEFAULT_TRANSLATION_LANGUAGES = ['am', 'om', 'ti', 'aa']
/** Any http(s) URL: YouTube, direct mp4/webm, Wikimedia, CDN, etc. Restrict with CAPTION_ALLOWED_HOSTS. */
export const DEFAULT_ALLOWED_HOSTS = ['*']

/** True when both stores are configured; the caption endpoints and workers stay off otherwise. */
export function captionsEnabled(env: Env): boolean {
  return !!env.POSTGRES_URL?.trim() && !!env.REDIS_URL?.trim()
}

export function loadCaptionConfig(env: Env = process.env as Env): CaptionConfig {
  const postgresUrl = env.POSTGRES_URL?.trim()
  const redisUrl = env.REDIS_URL?.trim()
  if (!postgresUrl || !redisUrl) {
    throw new Error('POSTGRES_URL and REDIS_URL are required for URL captions (ADR 0007)')
  }
  const list = (raw: string | undefined, fallback: string[]) => {
    const items = raw
      ?.split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    return items?.length ? items : fallback
  }
  const languages = list(env.TRANSLATION_LANGUAGES, DEFAULT_TRANSLATION_LANGUAGES)
  for (const lang of languages) {
    if (!isLanguageCode(lang)) throw new Error(`TRANSLATION_LANGUAGES has an invalid code: ${lang}`)
  }

  return {
    postgresUrl,
    redisUrl,
    redisPrefix: env.CAPTION_REDIS_PREFIX?.trim() || 'abol',
    allowedHosts: list(env.CAPTION_ALLOWED_HOSTS, DEFAULT_ALLOWED_HOSTS),
    translationLanguages: languages,
    defaultSourceLanguage: env.CAPTION_DEFAULT_SOURCE_LANGUAGE?.trim() || 'en',
    maxDurationSeconds: positiveInt(env, 'CAPTION_MAX_DURATION_SECONDS', 3600),
    cacheTtlSeconds: positiveInt(env, 'CAPTION_CACHE_TTL_SECONDS', 86_400),
    jobAttempts: positiveInt(env, 'CAPTION_JOB_ATTEMPTS', 3),
    jobBackoffMs: positiveInt(env, 'CAPTION_JOB_BACKOFF_MS', 10_000),
    transcribeConcurrency: positiveInt(env, 'CAPTION_TRANSCRIBE_CONCURRENCY', 2),
    translateConcurrency: positiveInt(env, 'CAPTION_TRANSLATE_CONCURRENCY', 4),
    rateLimit: {
      windowSeconds: positiveInt(env, 'RATE_LIMIT_WINDOW_SECONDS', 60),
      jobRequests: positiveInt(env, 'RATE_LIMIT_JOB_REQUESTS', 10),
      readRequests: positiveInt(env, 'RATE_LIMIT_READ_REQUESTS', 300),
      trustProxy: ['1', 'true', 'yes'].includes(env.TRUST_PROXY?.trim().toLowerCase() ?? ''),
    },
  }
}

/** BCP 47-ish: `am`, `om`, `aa`, `pt-BR`. */
export function isLanguageCode(value: string): boolean {
  return /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(value)
}

function positiveInt(env: Env, name: string, fallback: number): number {
  const raw = env[name]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0)
    throw new Error(`${name} must be a positive integer, got ${raw}`)
  return n
}
