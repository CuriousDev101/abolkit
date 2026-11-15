import { ProviderError } from './errors.ts'
import { createCloudStubTranscriber } from './transcribers/cloud-stub.ts'
import { createMmsHttpTranscriber } from './transcribers/mms-http.ts'
import { createStubTranscriber } from './transcribers/stub.ts'
import type { ProviderConfig, Transcriber } from './types.ts'

export type TranscriberSelection = Pick<
  ProviderConfig,
  'transcriber' | 'transcriberUrl' | 'transcriberOffHostConsent'
>

/**
 * Build the configured Transcriber.
 * Default id is mms-http (ADR 0003 / spike #7). Cloud ids require consent.
 */
export function createTranscriber(config: TranscriberSelection): Transcriber {
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
    case 'cloud': {
      if (!config.transcriberOffHostConsent) {
        throw new ProviderError(
          'CONSENT_REQUIRED',
          `TRANSCRIBER=cloud sends audio off the host. Set TRANSCRIBER_OFF_HOST_CONSENT=true only after the operator consents (ADR 0003). Default remains mms-http or stub.`,
        )
      }
      return createCloudStubTranscriber()
    }
    default:
      throw new ProviderError(
        'BAD_CONFIG',
        `Unknown transcriber "${id}". Use mms-http, stub, or cloud (consent required).`,
      )
  }
}

/** Read provider selection from process env (worker/api). */
export function transcriberConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): TranscriberSelection {
  const consentRaw = env.TRANSCRIBER_OFF_HOST_CONSENT?.trim().toLowerCase()
  return {
    transcriber: env.TRANSCRIBER ?? 'mms-http',
    transcriberUrl: env.TRANSCRIBER_URL,
    transcriberOffHostConsent: consentRaw === 'true' || consentRaw === '1' || consentRaw === 'yes',
  }
}
