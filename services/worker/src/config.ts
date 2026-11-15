import { providerConfigFromEnv, type ProviderConfig } from '@abolkit/provider-sdk'

type Env = Record<string, string | undefined>

export function loadWorkerConfig(env: Env = process.env as Env): ProviderConfig {
  return providerConfigFromEnv(env)
}
