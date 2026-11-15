import { ProviderError } from '../errors.ts'
import type { Translator } from '../types.ts'

/**
 * Skeleton for a future cloud translation adapter (ADR 0003).
 * Declares `sendsDataOffHost: true`; factories must require consent before returning it.
 */
export function createCloudTranslatorSkeleton(): Translator {
  return {
    id: 'cloud',
    label: 'Cloud translator (not implemented)',
    sendsDataOffHost: true,
    async translate() {
      throw new ProviderError(
        'NOT_IMPLEMENTED',
        'Cloud translation is a skeleton only. Use TRANSLATOR=none or stub until #30 lands a real adapter.',
      )
    },
  }
}
