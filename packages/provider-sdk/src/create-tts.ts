import { assertOffHostAllowed } from './consent.ts'
import { ProviderError } from './errors.ts'
import {
  assemblyAiTtsConfigFromEnv,
  createAssemblyAiTts,
  type AssemblyAiTtsOptions,
} from './tts/assemblyai.ts'
import { createCloudTtsSkeleton } from './tts/cloud.ts'
import { createRecordedClipsTts } from './tts/recorded-clips.ts'
import { createStubTts } from './tts/stub.ts'
import type { ProviderConfig, Tts } from './types.ts'

export type CreateTtsOptions = Pick<
  ProviderConfig,
  'tts' | 'allowOffHostProviders' | 'ttsOffHostConsent'
> & {
  /** Optional root for recorded-clips lookup (worker sets this). */
  clipsRoot?: string
  /** Read from ASSEMBLYAI_* / ASSEMBLYAI_TTS_*; only used when tts is `assemblyai`. */
  assemblyAi?: Omit<AssemblyAiTtsOptions, 'fetch'>
}

/** Build the configured Tts. Default id is `recorded-clips` (local, no cloud). */
export function createTts(config: CreateTtsOptions): Tts {
  const id = config.tts || 'recorded-clips'

  switch (id) {
    case 'recorded-clips':
      return createRecordedClipsTts({ clipsRoot: config.clipsRoot })
    case 'stub':
      return createStubTts()
    case 'cloud': {
      const tts = createCloudTtsSkeleton()
      assertOffHostAllowed(tts, config.allowOffHostProviders)
      return tts
    }
    case 'assemblyai': {
      const consent =
        config.ttsOffHostConsent === true || config.allowOffHostProviders === true
      if (!consent) {
        throw new ProviderError(
          'CONSENT_REQUIRED',
          'TTS=assemblyai sends text off the host. Set TTS_OFF_HOST_CONSENT=true (or ALLOW_OFF_HOST_PROVIDERS=true) after the operator consents (ADR 0003).',
        )
      }
      return createAssemblyAiTts(config.assemblyAi ?? assemblyAiTtsConfigFromEnv(process.env))
    }
    default:
      throw new ProviderError(
        'BAD_CONFIG',
        `Unknown tts "${id}". Use recorded-clips, stub, assemblyai, or cloud (consent required).`,
      )
  }
}

/** Read TTS selection from process env (api/worker). */
export function ttsConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): CreateTtsOptions {
  const tts = env.TTS?.trim() || 'recorded-clips'
  const consentRaw = env.TTS_OFF_HOST_CONSENT?.trim().toLowerCase()
  const consentUnset = consentRaw == null || consentRaw === ''
  return {
    tts,
    allowOffHostProviders: parseBool(env.ALLOW_OFF_HOST_PROVIDERS, false),
    // Default true when unset so Compose/job-summary TTS can run once TTS=assemblyai is chosen.
    ttsOffHostConsent:
      consentUnset || consentRaw === 'true' || consentRaw === '1' || consentRaw === 'yes',
    ...(tts === 'assemblyai' ? { assemblyAi: assemblyAiTtsConfigFromEnv(env) } : {}),
  }
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}
