import {
  assertAllowedHost,
  captionsEnabled,
  createCaptionCache,
  createCaptionQueues,
  createCaptionRepository,
  createPool,
  createRateLimiter,
  createRedis,
  identifyVideoUrl,
  loadCaptionConfig,
  migrate,
  VideoUrlError,
  type CaptionCache,
  type CaptionConfig,
  type CaptionJobRecord,
  type CaptionQueues,
  type CaptionRecord,
  type CaptionRepository,
  type RateLimiter,
  type VideoIdentity,
  type VideoRecord,
} from '@abolkit/caption-store'

import { HttpError } from '../http.ts'
import type { CaptionJobBody, CaptionStatusBody } from './schemas.ts'

type Env = Record<string, string | undefined>

/** Everything the caption routes use. Built from env in production, injected in tests. */
export interface CaptionBackend {
  config: CaptionConfig
  repo: CaptionRepository
  cache: CaptionCache
  queues: CaptionQueues
  rateLimiter: RateLimiter
  /** Resolves once the Postgres schema exists. */
  ready(): Promise<void>
  close?(): Promise<void>
}

const ENQUEUE_TIMEOUT_MS = 5_000

/** `null` when POSTGRES_URL or REDIS_URL is missing: the caption routes then answer 503. */
export function createCaptionBackend(env: Env): CaptionBackend | null {
  if (!captionsEnabled(env)) return null
  const config = loadCaptionConfig(env)
  const db = createPool(config.postgresUrl)
  const redis = createRedis(config.redisUrl)
  const onError = (error: unknown) =>
    console.warn(
      JSON.stringify({
        event: 'captions.redis_error',
        error: error instanceof Error ? error.message : String(error),
      }),
    )
  redis.on('error', onError)

  let migrated: Promise<void> | undefined
  return {
    config,
    repo: createCaptionRepository(db),
    cache: createCaptionCache(redis, {
      prefix: config.redisPrefix,
      ttlSeconds: config.cacheTtlSeconds,
      onError,
    }),
    queues: createCaptionQueues(config),
    rateLimiter: createRateLimiter(redis, {
      prefix: config.redisPrefix,
      windowSeconds: config.rateLimit.windowSeconds,
      onError,
    }),
    ready() {
      migrated ??= migrate(db).catch((error: unknown) => {
        migrated = undefined
        throw error
      })
      return migrated
    },
    async close() {
      redis.disconnect()
      await db.end()
    },
  }
}

export interface CaptionRequest {
  url: string
  /** `translate` needs an existing transcript (or a running transcribe job to join). */
  mode: 'transcribe' | 'translate' | 'generate'
  languages: string[]
  sourceLanguage?: string
  /** Origin used to turn caption paths into absolute URLs. */
  baseUrl: string
}

export function createCaptionService(backend: CaptionBackend) {
  const { config, repo, cache, queues } = backend

  function identify(url: string, checkHost: boolean): VideoIdentity {
    try {
      const identity = identifyVideoUrl(url)
      if (checkHost) assertAllowedHost(identity, config.allowedHosts)
      return identity
    } catch (error) {
      if (error instanceof VideoUrlError) throw new HttpError(400, error.code, error.message)
      throw error
    }
  }

  async function findVideo(identity: VideoIdentity): Promise<VideoRecord | null> {
    const cachedId = await cache.getVideoId(identity.url)
    const video = cachedId ? await repo.getVideo(cachedId) : await repo.findVideoByUrl(identity.url)
    if (video && !cachedId) await cache.setVideoId(identity.url, video.id)
    return video
  }

  async function captionsOf(videoId: string): Promise<CaptionRecord[]> {
    const cached = await cache.getCaptionList(videoId)
    if (cached) return cached
    const captions = await repo.listCaptions(videoId)
    await cache.setCaptionList(videoId, captions)
    return captions
  }

  /** Queued rows are (re)added every time: BullMQ ignores a jobId it already has, and a lost enqueue heals. */
  async function enqueue(job: CaptionJobRecord): Promise<void> {
    if (job.status !== 'queued') return
    let timer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        queues.enqueue(job.type, { captionJobId: job.id, videoId: job.videoId }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Redis did not answer')), ENQUEUE_TIMEOUT_MS)
        }),
      ])
    } catch (error) {
      await repo.failJob(job.id, 'Could not reach the job queue', true)
      throw new HttpError(
        503,
        'QUEUE_UNAVAILABLE',
        `Could not queue the ${job.type} job: ${String(error)}`,
      )
    } finally {
      clearTimeout(timer)
    }
  }

  async function status(video: VideoRecord, baseUrl: string): Promise<CaptionStatusBody> {
    const [captions, jobs] = await Promise.all([
      captionsOf(video.id),
      repo.listLatestJobs(video.id),
    ])
    const hasTranscript = captions.some((c) => c.kind === 'transcript')
    const active = jobs.some((j) => j.status === 'queued' || j.status === 'running')
    const failed = jobs.some(
      (j) =>
        j.status === 'failed' &&
        (j.type === 'transcribe'
          ? !hasTranscript
          : !captions.some((c) => c.language === j.language)),
    )
    return {
      status: active ? 'processing' : failed ? 'failed' : 'ready',
      video: {
        id: video.id,
        url: video.url,
        sourceKind: video.sourceKind,
        title: video.title,
        durationSeconds: video.durationSeconds,
        sourceLanguage: video.sourceLanguage,
      },
      captions: captions.map((c) => ({
        language: c.language,
        kind: c.kind,
        translatedFrom: c.translatedFrom,
        provider: c.provider,
        url: new URL(c.url, baseUrl).href,
        cueCount: c.cueCount,
        needsReview: c.needsReview,
        updatedAt: c.updatedAt.toISOString(),
      })),
      jobs: jobs.map(toJobBody),
    }
  }

  return {
    async request(
      input: CaptionRequest,
    ): Promise<{ httpStatus: 200 | 202; body: CaptionStatusBody }> {
      const identity = identify(input.url, true)
      const languages = [...new Set(input.languages)]
      const unsupported = languages.filter((lang) => !config.translationLanguages.includes(lang))
      if (unsupported.length) {
        throw new HttpError(
          400,
          'UNSUPPORTED_LANGUAGE',
          `Unsupported language(s): ${unsupported.join(', ')}. Supported: ${config.translationLanguages.join(', ')}`,
        )
      }
      await backend.ready()

      let video: VideoRecord | null
      if (input.mode === 'translate') {
        video = await findVideo(identity)
        if (!video) throw noTranscript()
      } else {
        video = await repo.upsertVideo(identity, input.url.trim())
        await cache.setVideoId(identity.url, video.id)
      }

      const transcript = await repo.getTranscript(video.id)
      if (!transcript) {
        if (input.mode === 'translate') {
          const running = (await repo.listLatestJobs(video.id)).some(
            (j) => j.type === 'transcribe' && (j.status === 'queued' || j.status === 'running'),
          )
          if (!running) throw noTranscript()
        }
        const { job } = await repo.createJob({
          videoId: video.id,
          type: 'transcribe',
          translateTo: languages,
          sourceLanguage: input.sourceLanguage ?? null,
        })
        await enqueue(job)
      } else {
        for (const language of languages) {
          if (language === transcript.language || (await repo.getCaption(video.id, language)))
            continue
          const { job } = await repo.createJob({
            videoId: video.id,
            type: 'translate',
            language,
            sourceLanguage: transcript.language,
          })
          await enqueue(job)
        }
      }

      const body = await status(video, input.baseUrl)
      return { httpStatus: body.status === 'processing' ? 202 : 200, body }
    },

    async lookup(url: string, baseUrl: string): Promise<CaptionStatusBody | null> {
      const identity = identify(url, false)
      await backend.ready()
      const video = await findVideo(identity)
      return video ? status(video, baseUrl) : null
    },

    async vtt(videoId: string, language: string): Promise<string | null> {
      const cached = await cache.getVtt(videoId, language)
      if (cached != null) return cached
      await backend.ready()
      const caption = await repo.getCaption(videoId, language)
      if (!caption) return null
      await cache.setVtt(videoId, language, caption.vtt)
      return caption.vtt
    },

    async job(id: string): Promise<CaptionJobBody | null> {
      await backend.ready()
      const job = await repo.getJob(id)
      return job ? toJobBody(job) : null
    },
  }
}

export type CaptionService = ReturnType<typeof createCaptionService>

function noTranscript() {
  return new HttpError(
    409,
    'NO_SOURCE_CAPTION',
    'This video has no transcript yet. Call /api/captions/transcribe or /api/captions/generate first.',
  )
}

function toJobBody(job: CaptionJobRecord): CaptionJobBody {
  return {
    id: job.id,
    videoId: job.videoId,
    type: job.type,
    language: job.language,
    translateTo: job.translateTo,
    status: job.status,
    progress: job.progress,
    attempts: job.attempts,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
  }
}
