import {
  createCaptionCache,
  createCaptionQueues,
  createCaptionWorker,
  createPool,
  createRedis,
  failJob,
  loadCaptionConfig,
  migrate,
  type CaptionJobType,
} from '@abolkit/caption-store'
import {
  createStorage,
  createTranscriber,
  createTranslator,
  translatorConfigFromEnv,
} from '@abolkit/provider-sdk'
import { UnrecoverableError } from 'bullmq'

import { loadWorkerConfig } from '../config.ts'
import { createCaptionProcessors, isPermanentError } from './processors.ts'

export { createCaptionProcessors, isPermanentError, normalizeLanguage } from './processors.ts'
export type { CaptionProcessorDeps, CaptionProcessors } from './processors.ts'
export { extractAudio, probeSource, type SourceTools } from './source.ts'

type Env = Record<string, string | undefined>
type Log = (event: Record<string, unknown>) => void

/** Start the BullMQ transcribe and translate workers (ADR 0007). Resolves with a stop function. */
export async function startCaptionWorkers(env: Env, log: Log): Promise<() => Promise<void>> {
  const config = loadCaptionConfig(env)
  const workerConfig = loadWorkerConfig(env)
  const transcriber = createTranscriber(workerConfig)
  const translator = createTranslator(translatorConfigFromEnv(env))

  const db = createPool(config.postgresUrl)
  await migrate(db)
  const redis = createRedis(config.redisUrl)
  const onRedisError = (error: unknown) =>
    log({
      event: 'captions.redis_error',
      error: error instanceof Error ? error.message : String(error),
    })
  redis.on('error', onRedisError)
  const cache = createCaptionCache(redis, {
    prefix: config.redisPrefix,
    ttlSeconds: config.cacheTtlSeconds,
    onError: onRedisError,
  })
  const queues = createCaptionQueues(config)
  const processors = createCaptionProcessors({
    db,
    cache,
    queues,
    storage: createStorage({ storage: workerConfig.storage, env }),
    transcriber,
    translator,
    config,
    tools: {
      ffmpegBin: workerConfig.ffmpegBin,
      ffprobeBin: env.FFPROBE_BIN?.trim() || undefined,
      ytDlpBin: env.YTDLP_BIN?.trim() || undefined,
      ytDlpJsRuntimes: env.YTDLP_JS_RUNTIMES?.trim() ?? 'node',
      ytDlpCookiesFile: env.YTDLP_COOKIES_FILE?.trim() || undefined,
    },
    workDir: workerConfig.workDir,
    log,
  })

  const types: CaptionJobType[] = ['transcribe', 'translate']
  const workers = types.map((type) => {
    const worker = createCaptionWorker(config, type, async (job, signal) => {
      try {
        await processors[type](job, signal)
      } catch (error) {
        if (isPermanentError(error) && !(error instanceof UnrecoverableError)) {
          throw new UnrecoverableError(error instanceof Error ? error.message : String(error))
        }
        throw error
      }
    })
    worker.on('failed', (job, error) => {
      if (!job) return
      const final =
        error instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? 1)
      log({
        event: 'captions.job.failed',
        type,
        captionJobId: job.data.captionJobId,
        attempt: job.attemptsMade,
        final,
        error: error.message,
      })
      failJob(db, job.data.captionJobId, error.message, final).catch((err: unknown) =>
        log({ event: 'captions.job.fail_record_error', error: String(err) }),
      )
    })
    worker.on('error', (error) =>
      log({ event: 'captions.worker_error', type, error: error.message }),
    )
    return worker
  })

  log({
    event: 'captions.started',
    transcriber: transcriber.id,
    translator: translator?.id ?? 'none',
    sendsDataOffHost: transcriber.sendsDataOffHost || translator?.sendsDataOffHost === true,
    transcribeConcurrency: config.transcribeConcurrency,
    translateConcurrency: config.translateConcurrency,
  })

  return async () => {
    await Promise.all(workers.map((worker) => worker.close()))
    await queues.close()
    redis.disconnect()
    await db.end()
  }
}
