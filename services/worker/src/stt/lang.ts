import { JobError, type JsonObject } from '@abolkit/jobs'
import type { LangCode } from '@abolkit/provider-sdk'

const SUPPORTED: readonly LangCode[] = ['en', 'am']

/** Read caption language from job params. Defaults to `en`; rejects languages we do not support (ADR 0003). */
export function langFromJobParams(params: JsonObject): LangCode {
  const raw = params.language ?? params.lang
  if (raw == null) return 'en'
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (SUPPORTED.includes(normalized)) return normalized
  throw new JobError(`Unsupported language "${String(raw)}". Use en or am.`, { retryable: false })
}
