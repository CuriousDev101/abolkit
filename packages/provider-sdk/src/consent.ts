import { ProviderError } from './errors.ts'
import type { ProviderInfo } from './types.ts'

/**
 * Cloud / off-host adapters may only be constructed when the deploy config
 * explicitly opts in (ADR 0003). The API/review UI must also show a consent notice.
 */
export function assertOffHostAllowed(
  info: Pick<ProviderInfo, 'id' | 'label' | 'sendsDataOffHost'>,
  allowOffHostProviders: boolean | undefined,
): void {
  if (!info.sendsDataOffHost) return
  if (allowOffHostProviders === true) return
  throw new ProviderError(
    'CONSENT_REQUIRED',
    `Provider "${info.id}" (${info.label}) sends data off the host. ` +
      'Set ALLOW_OFF_HOST_PROVIDERS=true (and show a consent notice) before enabling it.',
  )
}
