import type { ProviderConfig } from './types.ts'
import { transcriberConfigFromEnv } from './create-transcriber.ts'
import { ttsConfigFromEnv } from './create-tts.ts'
import { storageConfigFromEnv } from './storage/create-storage.ts'

type Env = Record<string, string | undefined>

/**
 * Read provider selection from process env (api/worker).
 * Defaults need no cloud accounts: stub/mms-http STT, translator none, recorded TTS, local-disk storage.
 */
export function providerConfigFromEnv(env: Env = process.env): ProviderConfig {
  const tts = ttsConfigFromEnv(env)
  return {
    ...transcriberConfigFromEnv(env),
    ...storageConfigFromEnv(env),
    translator: env.TRANSLATOR?.trim() || 'none',
    tts: tts.tts,
    translatorOffHostConsent: parseBool(env.TRANSLATOR_OFF_HOST_CONSENT, false),
    ttsOffHostConsent: tts.ttsOffHostConsent,
    allowOffHostProviders: tts.allowOffHostProviders,
  }
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}
