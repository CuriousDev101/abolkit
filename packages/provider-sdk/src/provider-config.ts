import type { ProviderConfig } from './types.ts'
import { transcriberConfigFromEnv } from './create-transcriber.ts'
import { storageConfigFromEnv } from './storage/create-storage.ts'

type Env = Record<string, string | undefined>

/**
 * Read provider selection from process env (api/worker).
 * Defaults need no cloud accounts: stub/mms-http STT, translator none, recorded TTS, local-disk storage.
 */
export function providerConfigFromEnv(env: Env = process.env): ProviderConfig {
  return {
    ...transcriberConfigFromEnv(env),
    ...storageConfigFromEnv(env),
    translator: env.TRANSLATOR?.trim() || 'none',
    tts: env.TTS?.trim() || 'recorded-clips',
    translatorOffHostConsent: parseBool(env.TRANSLATOR_OFF_HOST_CONSENT, false),
    allowOffHostProviders: parseBool(env.ALLOW_OFF_HOST_PROVIDERS, false),
  }
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}
