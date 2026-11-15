import type { OpenAPIHono } from '@hono/zod-openapi'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context, MiddlewareHandler } from 'hono'

import { HttpError, jsonError } from '../http.ts'
import {
  captionJobRoute,
  generateRoute,
  lookupRoute,
  transcribeRoute,
  translateRoute,
  vttRoute,
} from './routes.ts'
import { createCaptionService, type CaptionBackend, type CaptionService } from './service.ts'

/** Paths served by the public caption API; the API-key middleware skips them. */
export function isCaptionPath(path: string): boolean {
  return (
    path === '/api/captions' ||
    path.startsWith('/api/captions/') ||
    path.startsWith('/api/caption-jobs/') ||
    /^\/api\/videos\/[^/]+\/captions\//.test(path)
  )
}

export function registerCaptionRoutes(
  app: OpenAPIHono,
  backend: CaptionBackend | null,
  publicBaseUrl: string | undefined,
) {
  const service = backend ? createCaptionService(backend) : null
  const need = (): CaptionService => {
    if (!service) {
      throw new HttpError(
        503,
        'CAPTIONS_DISABLED',
        'URL captions need POSTGRES_URL and REDIS_URL on the API',
      )
    }
    return service
  }
  const baseUrl = (c: Context) => publicBaseUrl ?? new URL(c.req.url).origin

  if (backend) {
    const limit = rateLimit(backend)
    for (const path of [
      '/api/captions',
      '/api/captions/*',
      '/api/caption-jobs/*',
      '/api/videos/:id/captions/*',
    ]) {
      app.use(path, limit)
    }
  }

  app.openapi(transcribeRoute, async (c) => {
    const { url, sourceLanguage } = c.req.valid('json')
    const out = await need().request({
      url,
      mode: 'transcribe',
      languages: [],
      sourceLanguage,
      baseUrl: baseUrl(c),
    })
    return c.json(out.body, out.httpStatus)
  })

  app.openapi(translateRoute, async (c) => {
    const { url, languages } = c.req.valid('json')
    const out = await need().request({ url, mode: 'translate', languages, baseUrl: baseUrl(c) })
    return c.json(out.body, out.httpStatus)
  })

  app.openapi(generateRoute, async (c) => {
    const { url, languages, sourceLanguage } = c.req.valid('json')
    const out = await need().request({
      url,
      mode: 'generate',
      languages: languages ?? backend?.config.translationLanguages ?? [],
      sourceLanguage,
      baseUrl: baseUrl(c),
    })
    return c.json(out.body, out.httpStatus)
  })

  app.openapi(lookupRoute, async (c) => {
    const { url } = c.req.valid('query')
    const body = await need().lookup(url, baseUrl(c))
    if (!body)
      throw new HttpError(404, 'NOT_FOUND', 'No captions have been requested for this video')
    c.header('Cache-Control', 'no-store')
    return c.json(body, 200)
  })

  app.openapi(vttRoute, async (c) => {
    const { id, lang } = c.req.valid('param')
    const vtt = await need().vtt(id, lang)
    if (vtt == null) throw new HttpError(404, 'NOT_FOUND', `No ${lang} caption for this video`)
    return c.body(vtt, 200, {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    })
  })

  app.openapi(captionJobRoute, async (c) => {
    const { id } = c.req.valid('param')
    const job = await need().job(id)
    if (!job) throw new HttpError(404, 'NOT_FOUND', 'Caption job not found')
    c.header('Cache-Control', 'no-store')
    return c.json(job, 200)
  })
}

function rateLimit(backend: CaptionBackend): MiddlewareHandler {
  const { rateLimit: limits } = backend.config
  return async (c, next) => {
    if (c.req.method === 'OPTIONS') return next()
    const write = c.req.method === 'POST'
    const result = await backend.rateLimiter.hit(
      write ? 'captions-write' : 'captions-read',
      clientIp(c, limits.trustProxy),
      write ? limits.jobRequests : limits.readRequests,
    )
    c.header('RateLimit-Limit', String(result.limit))
    c.header('RateLimit-Remaining', String(result.remaining))
    c.header('RateLimit-Reset', String(result.resetSeconds))
    if (!result.allowed) {
      c.header('Retry-After', String(result.resetSeconds))
      return jsonError(
        c,
        429,
        'RATE_LIMITED',
        `Too many requests; try again in ${result.resetSeconds} s`,
      )
    }
    return next()
  }
}

function clientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    if (forwarded) return forwarded
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
