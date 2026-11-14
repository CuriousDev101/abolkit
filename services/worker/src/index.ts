// Worker entry point. Owner: pair "ol".
// STT: HTTP client to external MMS wrapper (spike #7). Model lives in another repo.
// TODO(#25): queue + job runner. TODO(#26): ffmpeg. TODO(#27): full job wiring.

import { createTranscriber, ProviderError } from '@abolkit/provider-sdk'
import { loadWorkerConfig } from './config.js'

export { loadWorkerConfig }

export function createWorkerTranscriber(env: Record<string, string | undefined> = process.env) {
  const config = loadWorkerConfig(env)
  return createTranscriber(config)
}

/** Dev helper: resolve transcriber and print which backend will be used. */
export async function main(): Promise<void> {
  try {
    const config = loadWorkerConfig()
    const transcriber = createTranscriber(config)
    console.log(
      JSON.stringify({
        ok: true,
        transcriber: transcriber.id,
        label: transcriber.label,
        sendsDataOffHost: transcriber.sendsDataOffHost,
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

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('worker/src/index.ts') || process.argv[1].endsWith('worker/src/index.js'))

if (isDirectRun) {
  void main()
}
