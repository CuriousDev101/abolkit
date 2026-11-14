import { transcriberConfigFromEnv, type ProviderConfig } from '@abolkit/provider-sdk'

type Env = Record<string, string | undefined>

export function loadWorkerConfig(
  env: Env = process.env as Env,
): Pick<ProviderConfig, 'transcriber' | 'transcriberUrl' | 'translator' | 'tts' | 'storage'> {
  return {
    ...transcriberConfigFromEnv(env),
    translator: env.TRANSLATOR ?? 'none',
    tts: env.TTS ?? 'recorded-clips',
    storage: env.STORAGE ?? 'local-disk',
  }
}
