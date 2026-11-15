// Worker entry point. Owner: pair "ol".
// Separate process from the API: polls the SQLite DB-backed queue (#25, ADR 0005),
// runs handlers with a lease, retries failures with backoff.
// #26: ffmpeg extract (16 kHz mono) + Opus 24 kbps + 240p; sizes logged for the pack report.
// #27: Transcriber adapter → WebVTT [needsReview]. Default STT is external MMS (mms-http);
//     model weights live in another repo. Cloud adapters need explicit consent.

import { captionsEnabled } from '@abolkit/caption-store'
import { migrateJobs, openSqlite } from '@abolkit/jobs'
import { createStorage, createTranscriber, ProviderError } from '@abolkit/provider-sdk'

import { startCaptionWorkers } from './captions/index.ts'
import { loadQueueConfig, loadWorkerConfig } from './config.ts'
import { createDefaultHandlers } from './handlers.ts'
import { createJobRunner } from './runner.ts'

export { loadQueueConfig, loadWorkerConfig }
export { createDefaultHandlers, type HandlerDeps } from './handlers.ts'
export {
  produceAssetMedia,
  extract16kMono,
  encodeOpus24k,
  encodeVideo240p,
  runFfmpeg,
  audio16kKey,
  captionsKey,
  opusAudioKey,
  sourceKey,
  video240pKey,
} from './ffmpeg/index.ts'
export { langFromJobParams, markNeedsReview, transcribeStoredAudio } from './stt/index.ts'
export { createJobRunner, type JobContext, type JobHandler, type JobHandlers } from './runner.ts'
export {
  createCaptionProcessors,
  extractAudio,
  isPermanentError,
  normalizeLanguage,
  probeSource,
  startCaptionWorkers,
  type CaptionProcessorDeps,
  type CaptionProcessors,
  type SourceTools,
} from './captions/index.ts'

const log = (event: Record<string, unknown>) => console.log(JSON.stringify(event))

export function createWorkerTranscriber(env: Record<string, string | undefined> = process.env) {
  const config = loadWorkerConfig(env)
  return createTranscriber(config)
}

/** Dev helper: resolve transcriber and print which backend will be used. */
export function printTranscriberInfo(): void {
  try {
    const config = loadWorkerConfig()
    const transcriber = createTranscriber(config)
    console.log(
      JSON.stringify({
        ok: true,
        transcriber: transcriber.id,
        label: transcriber.label,
        sendsDataOffHost: transcriber.sendsDataOffHost,
        offHostConsent: config.transcriberOffHostConsent === true,
        url: config.transcriberUrl ?? null,
      }),
    )
  } catch (err: unknown) {
    if (err instanceof ProviderError) {
      console.error(JSON.stringify({ ok: false, code: err.code, message: err.message }))
      process.exitCode = 1
      return
    }
    throw err
  }
}

/**
 * Run until SIGINT/SIGTERM. Starts the SQLite asset job loop when DATABASE_URL is set and the
 * URL caption workers (BullMQ) when POSTGRES_URL and REDIS_URL are set.
 */
export async function main(env: Record<string, string | undefined> = process.env): Promise<void> {
  const runAssets = !!env.DATABASE_URL?.trim()
  const runCaptions = captionsEnabled(env)
  if (!runAssets && !runCaptions) {
    throw new Error(
      'Nothing to run: set DATABASE_URL for asset jobs and/or POSTGRES_URL + REDIS_URL for URL captions',
    )
  }

  let stopCaptions: (() => Promise<void>) | undefined
  if (runCaptions) stopCaptions = await startCaptionWorkers(env, log)

  if (!runAssets) {
    await new Promise<void>((resolve) => {
      const stop = (signal: string) => {
        log({ event: 'worker.stopping', signal })
        resolve()
      }
      process.once('SIGINT', () => stop('SIGINT'))
      process.once('SIGTERM', () => stop('SIGTERM'))
    })
    await stopCaptions?.()
    log({ event: 'worker.stopped' })
    return
  }

  const queue = loadQueueConfig(env)
  const worker = loadWorkerConfig(env)
  const db = openSqlite(queue.databaseUrl)
  migrateJobs(db)

  const storage = createStorage({ storage: worker.storage, env })
  const transcriber = createTranscriber(worker)
  const handlers = createDefaultHandlers({
    storage,
    transcriber,
    workDir: worker.workDir,
    ffmpegBin: worker.ffmpegBin,
    log,
  })

  const runner = createJobRunner({
    db,
    handlers,
    leaseSeconds: queue.leaseSeconds,
    pollIntervalMs: queue.pollIntervalMs,
    backoff: { baseMs: queue.retryBaseMs, maxMs: queue.retryMaxMs },
    log,
  })

  const shutdown = (signal: string) => {
    log({ event: 'worker.stopping', signal })
    void runner.stop()
  }
  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))

  log({
    event: 'worker.started',
    pollIntervalMs: queue.pollIntervalMs,
    leaseSeconds: queue.leaseSeconds,
    storage: storage.id,
    transcriber: transcriber.id,
    sendsDataOffHost: transcriber.sendsDataOffHost,
    workDir: worker.workDir,
  })
  await runner.start()
  db.close()
  await stopCaptions?.()
  log({ event: 'worker.stopped' })
}

const entry = process.argv[1]?.replaceAll('\\', '/')
const isDirectRun =
  entry?.endsWith('worker/src/index.ts') === true || entry?.endsWith('worker/src/index.js') === true

if (isDirectRun) {
  if (process.argv.includes('--info')) {
    printTranscriberInfo()
  } else {
    main().catch((err: unknown) => {
      console.error(
        JSON.stringify({
          event: 'worker.crashed',
          error: err instanceof Error ? err.message : String(err),
        }),
      )
      process.exitCode = 1
    })
  }
}
