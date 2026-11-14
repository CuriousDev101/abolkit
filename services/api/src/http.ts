import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { ZodError } from 'zod'

import type { ErrorBody } from './schemas.ts'

/** Stable JSON error body from architecture.md. */
export function jsonError(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
) {
  return c.json({ error: { code, message } } satisfies ErrorBody, status)
}

/** Shared Zod validation failure → 400 VALIDATION. */
export function validationHook(
  result: { success: true; data: unknown } | { success: false; error: ZodError },
  c: Context,
) {
  if (result.success) return
  const message = result.error.issues.map((issue) => issue.message).join('; ')
  return jsonError(c, 400, 'VALIDATION', message || 'Invalid request')
}
