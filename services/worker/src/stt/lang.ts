import type { LangCode } from '@abolkit/provider-sdk'
import type { JsonObject } from '@abolkit/jobs'

/** Read caption language from job params. Default `en` when missing or unknown. */
export function langFromJobParams(params: JsonObject): LangCode {
  const raw = params.language ?? params.lang
  if (typeof raw !== 'string') return 'en'
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'am' || normalized === 'en') return normalized
  return 'en'
}
