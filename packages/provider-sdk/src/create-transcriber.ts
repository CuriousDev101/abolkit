import { assertOffHostAllowed } from './consent.ts'
import { ProviderError } from './errors.ts'
import { createAssemblyAiTranscriberSkeleton } from './transcribers/assemblyai.ts'
import { createMmsHttpTranscriber } from './transcribers/mms-http.ts'
import { createStubTranscriber } from './transcribers/stub.ts'
import type { ProviderConfig, Transcriber } from './types.ts'

/** Build the configured Transcriber. Default id is mms-http (ADR 0003 / spike #7). */
export function createTranscriber(
  config: Pick<ProviderConfig, 'transcriber' | 'transcriberUrl' | 'allowOffHostProviders'>,
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
    case 'assemblyai': {
      const transcriber = createAssemblyAiTranscriberSkeleton()
      assertOffHostAllowed(transcriber, config.allowOffHostProviders)
      return transcriber
    }
    default:
      throw new ProviderError(
        'BAD_CONFIG',
        `Unknown transcriber "${id}". Use mms-http, stub, or assemblyai (requires ALLOW_OFF_HOST_PROVIDERS).`,
      )
  }
}

/** Read transcriber selection from process env (worker/api). */
export function transcriberConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): Pick<ProviderConfig, 'transcriber' | 'transcriberUrl' | 'allowOffHostProviders'> {
  const allow =
    env.ALLOW_OFF_HOST_PROVIDERS != null &&
    ['1', 'true', 'yes', 'on'].includes(env.ALLOW_OFF_HOST_PROVIDERS.trim().toLowerCase())
  return {
    transcriber: env.TRANSCRIBER ?? 'mms-http',
    transcriberUrl: env.TRANSCRIBER_URL,
    allowOffHostProviders: allow,
  }
}
