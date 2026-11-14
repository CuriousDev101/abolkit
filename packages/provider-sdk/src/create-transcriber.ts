import { ProviderError } from './errors.js'
import { createMmsHttpTranscriber } from './transcribers/mms-http.js'
import { createStubTranscriber } from './transcribers/stub.js'
import type { ProviderConfig, Transcriber } from './types.js'

/** Build the configured Transcriber. Default id is mms-http (ADR 0003 / spike #7). */
export function createTranscriber(
  config: Pick<ProviderConfig, 'transcriber' | 'transcriberUrl'>,
): Transcriber {
  const id = config.transcriber || 'mms-http'

  switch (id) {
    case 'stub':
      return createStubTranscriber()
    case 'mms-http': {
      const baseUrl = config.transcriberUrl?.trim()
      if (!baseUrl) {
        throw new ProviderError(
          'BAD_CONFIG',
          'TRANSCRIBER=mms-http requires TRANSCRIBER_URL (external MMS wrapper). Use TRANSCRIBER=stub for local work without the model.',
        )
      }
      return createMmsHttpTranscriber({ baseUrl, sendsDataOffHost: false })
    }
    default:
      throw new ProviderError('BAD_CONFIG', `Unknown transcriber "${id}". Use mms-http or stub.`)
  }
}

/** Read provider selection from process env (worker/api). */
export function transcriberConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): Pick<ProviderConfig, 'transcriber' | 'transcriberUrl'> {
  return {
    transcriber: env.TRANSCRIBER ?? 'mms-http',
    transcriberUrl: env.TRANSCRIBER_URL,
  }
}
