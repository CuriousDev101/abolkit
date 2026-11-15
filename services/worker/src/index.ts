// Worker entry point. Owner: pair "ol".
// Separate process from the API: polls the SQLite DB-backed queue (#25, ADR 0005),
// runs handlers with a lease, retries failures with backoff.
// STT: HTTP client to external MMS wrapper (spike #7). Model lives in another repo.
// TODO(#26): wrap spikes/09-ffmpeg recipes. TODO(#27): STT job wiring.

import { migrateJobs, openSqlite } from '@abolkit/jobs'
import {
  createTranscriber,
  createTranslator,
  createTts,
  ProviderError,
} from '@abolkit/provider-sdk'

import { loadQueueConfig, loadWorkerConfig } from './config.ts'
import { createDefaultHandlers } from './handlers.ts'
import { createJobRunner } from './runner.ts'

export { loadQueueConfig, loadWorkerConfig }
export { createJobRunner, type JobContext, type JobHandler, type JobHandlers } from './runner.ts'

export function createWorkerTranscriber(env: Record<string, string | undefined> = process.env) {
  const config = loadWorkerConfig(env)
  return createTranscriber(config)
}

/** Dev helper: resolve providers and print which backends will be used (`--info`). */
export function printTranscriberInfo(): void {
  try {
    const config = loadWorkerConfig()
    const transcriber = createTranscriber(config)
    const translator = createTranslator(config)
    const tts = createTts(config)
    console.log(
      JSON.stringify({
        ok: true,
        allowOffHostProviders: config.allowOffHostProviders === true,
        transcriber: {
          id: transcriber.id,
          label: transcriber.label,
          sendsDataOffHost: transcriber.sendsDataOffHost,
          url: config.transcriberUrl ?? null,
        },
        translator: {
          id: translator.id,
          label: translator.label,
          sendsDataOffHost: translator.sendsDataOffHost,
        },
        tts: {
          id: tts.id,
          label: tts.label,
          sendsDataOffHost: tts.sendsDataOffHost,
          languages: tts.languages(),
        },
        storage: config.storage,
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

/** Run the job loop until SIGINT/SIGTERM. */
export async function main(env: Record<string, string | undefined> = process.env): Promise<void> {
  const queue = loadQueueConfig(env)
  const db = openSqlite(queue.databaseUrl)
  migrateJobs(db)

  const runner = createJobRunner({
    db,
    handlers: createDefaultHandlers(),
    leaseSeconds: queue.leaseSeconds,
    pollIntervalMs: queue.pollIntervalMs,
    backoff: { baseMs: queue.retryBaseMs, maxMs: queue.retryMaxMs },
  })

  const shutdown = (signal: string) => {
    console.log(JSON.stringify({ event: 'worker.stopping', signal }))
    void runner.stop()
  }
  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))

  console.log(
    JSON.stringify({
      event: 'worker.started',
      pollIntervalMs: queue.pollIntervalMs,
      leaseSeconds: queue.leaseSeconds,
    }),
  )
  await runner.start()
  db.close()
  console.log(JSON.stringify({ event: 'worker.stopped' }))
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
