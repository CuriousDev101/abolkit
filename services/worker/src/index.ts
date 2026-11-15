// Worker entry point. Owner: pair "ol".
// STT: HTTP client to external MMS wrapper (spike #7). Model lives in another repo.
// TODO(#25): queue + job runner. TODO(#26): wrap spikes/09-ffmpeg recipes. TODO(#27): STT job wiring.

import {
  createTranscriber,
  createTranslator,
  createTts,
  ProviderError,
} from '@abolkit/provider-sdk'
import { loadWorkerConfig } from './config.js'

export { loadWorkerConfig }

export function createWorkerTranscriber(env: Record<string, string | undefined> = process.env) {
  const config = loadWorkerConfig(env)
  return createTranscriber(config)
}

/** Dev helper: resolve providers and print which backends will be used. */
export async function main(): Promise<void> {
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

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('worker/src/index.ts') ||
    process.argv[1].endsWith('worker/src/index.js'))

if (isDirectRun) {
  void main()
}
