import type { MiddlewareHandler } from 'hono'

import { jsonError } from '../http.ts'

/**
 * Protects write routes (assets, jobs, caption puts — #24+).
 * Expects `X-API-Key` or `Authorization: Bearer <key>` matching config.
 * Read routes (health, OpenAPI, docs) stay open and must not use this.
 */
export function requireApiKey(expectedKey: string | undefined): MiddlewareHandler {
  return async (c, next) => {
    if (!expectedKey) {
      return jsonError(
        c,
        503,
        'API_KEY_UNSET',
        'Write routes need API_KEY in the API process environment.',
      )
    }

    const headerKey = c.req.header('x-api-key')
    const bearer = c.req.header('authorization')
    const token =
      headerKey?.trim() ||
      (bearer?.toLowerCase().startsWith('bearer ') ? bearer.slice(7).trim() : undefined)

    if (!token || token !== expectedKey) {
      return jsonError(c, 401, 'UNAUTHORIZED', 'Missing or invalid API key')
    }

    await next()
  }
}
