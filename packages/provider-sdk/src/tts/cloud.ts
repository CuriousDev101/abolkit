import { ProviderError } from '../errors.ts'
import type { LangCode, Tts } from '../types.ts'

/**
 * Skeleton for a future cloud TTS adapter (ADR 0003).
 * Declares `sendsDataOffHost: true`; factories must require consent before returning it.
 */
export function createCloudTtsSkeleton(): Tts {
  return {
    id: 'cloud',
    label: 'Cloud TTS (not implemented)',
    sendsDataOffHost: true,
    languages(): LangCode[] {
      return []
    },
    async synthesize() {
      throw new ProviderError(
        'NOT_IMPLEMENTED',
        'Cloud TTS is a skeleton only. Default remains TTS=recorded-clips (spike #8). Requires ALLOW_OFF_HOST_PROVIDERS.',
      )
    },
  }
}
