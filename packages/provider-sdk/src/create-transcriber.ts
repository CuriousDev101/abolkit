import { ProviderError } from './errors.ts'
import {
  assemblyAiConfigFromEnv,
  createAssemblyAiTranscriber,
  type AssemblyAiOptions,
} from './transcribers/assemblyai.ts'
import { createCloudStubTranscriber } from './transcribers/cloud-stub.ts'
import { createMmsHttpTranscriber } from './transcribers/mms-http.ts'
import { createStubTranscriber } from './transcribers/stub.ts'
import type { LangCode, ProviderConfig, Transcriber, TranscriptionResult } from './types.ts'

export type TranscriberSelection = Pick<
  ProviderConfig,
  'transcriber' | 'transcriberUrl' | 'transcriberOffHostConsent'
> & {
  /** Read from ASSEMBLYAI_* variables; only used when transcriber is `assemblyai`. */
  assemblyAi?: Omit<AssemblyAiOptions, 'readFile' | 'fetch' | 'sleep'>
}

/**
 * Build the configured Transcriber.
 * Default id is mms-http (ADR 0003 / spike #7). Off-host ids (cloud, assemblyai) require consent.
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
    case 'cloud':
    case 'assemblyai': {
      if (!config.transcriberOffHostConsent) {
        throw new ProviderError(
          'CONSENT_REQUIRED',
          `TRANSCRIBER=${id} sends audio off the host. Set TRANSCRIBER_OFF_HOST_CONSENT=true only after the operator consents (ADR 0003). Default remains mms-http or stub.`,
        )
      }
      if (id === 'cloud') return createCloudStubTranscriber()
      return createAssemblyAiTranscriber(config.assemblyAi ?? { apiKey: '' })
    }
    default:
      throw new ProviderError(
        'BAD_CONFIG',
        `Unknown transcriber "${id}". Use mms-http, stub, assemblyai or cloud (consent required).`,
      )
  }
}

/** Read provider selection from process env (worker/api). */
export function transcriberConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): TranscriberSelection {
  const consentRaw = env.TRANSCRIBER_OFF_HOST_CONSENT?.trim().toLowerCase()
  const transcriber = env.TRANSCRIBER ?? 'mms-http'
  // Default true for URL captions (team:ab): AssemblyAI/Gemini need consent to run.
  const consentUnset = consentRaw == null || consentRaw === ''
  return {
    transcriber,
    transcriberUrl: env.TRANSCRIBER_URL,
    transcriberOffHostConsent:
      consentUnset || consentRaw === 'true' || consentRaw === '1' || consentRaw === 'yes',
    ...(transcriber === 'assemblyai' ? { assemblyAi: assemblyAiConfigFromEnv(env) } : {}),
  }
}

/**
 * Transcribe with language detection where the provider supports it.
 * Providers without detection need `lang`; `fallbackLang` is used when it is missing.
 */
export async function transcribeWithDetails(
  transcriber: Transcriber,
  audioPath: string,
  opts: { lang?: LangCode; fallbackLang: LangCode; signal?: AbortSignal },
): Promise<TranscriptionResult> {
  if (transcriber.transcribeDetailed) {
    return transcriber.transcribeDetailed(audioPath, { lang: opts.lang, signal: opts.signal })
  }
  const lang = opts.lang && opts.lang !== 'auto' ? opts.lang : opts.fallbackLang
  return {
    cues: await transcriber.transcribe(audioPath, { lang, signal: opts.signal }),
    language: lang,
  }
}
