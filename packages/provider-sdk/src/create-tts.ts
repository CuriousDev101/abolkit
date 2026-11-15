import { assertOffHostAllowed } from './consent.ts'
import { ProviderError } from './errors.ts'
import { createCloudTtsSkeleton } from './tts/cloud.ts'
import { createRecordedClipsTts } from './tts/recorded-clips.ts'
import { createStubTts } from './tts/stub.ts'
import type { ProviderConfig, Tts } from './types.ts'

export type CreateTtsOptions = Pick<ProviderConfig, 'tts' | 'allowOffHostProviders'> & {
  /** Optional root for recorded-clips lookup (worker sets this). */
  clipsRoot?: string
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
    default:
      throw new ProviderError(
        'BAD_CONFIG',
        `Unknown tts "${id}". Use recorded-clips, stub, or cloud (requires ALLOW_OFF_HOST_PROVIDERS).`,
      )
  }
}
