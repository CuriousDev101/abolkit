import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'

import { loadApiConfig } from './config.ts'
import { embedScript } from './embed.ts'
import { jsonError, validationHook } from './http.ts'
import { openApiConfig } from './openapi.ts'
import { healthRoute } from './routes/health.ts'
import { loadScalarStandalone } from './scalar-asset.ts'
import { ErrorBodySchema } from './schemas.ts'

const DOCS_SCRIPT_PATH = '/docs/scalar.js'

/**
 * Hono + zod-openapi skeleton (#17).
 * Mounted now: health, OpenAPI, Scalar docs, spike embed script.
 * Write routes (#24+) will use requireApiKey(config.apiKey).
 */
export function createApp(env: Record<string, string | undefined> = process.env) {
  const config = loadApiConfig(env)
  const scalarJs = loadScalarStandalone()
  const app = new OpenAPIHono({ defaultHook: validationHook })

  app.openAPIRegistry.register('ErrorBody', ErrorBodySchema)

  // Reads are open for embeds and docs. Writes stay off this skeleton.
  app.use('*', readCors(config.corsOrigin))

  app.openapi(healthRoute, (c) => {
    return c.json({ ok: true, service: 'abolkit-api' }, 200)
  })

  app.doc31('/openapi.json', openApiConfig)

  app.get('/docs/scalar.js', (c) => {
    return c.body(scalarJs, 200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    })
  })

  // `cdn` is read by the Hono middleware and is not part of the public config type.
  // Empty proxyUrl stops the docs client from falling through to proxy.scalar.com.
  const docsPage = {
    url: '/openapi.json',
    pageTitle: 'Abol Kit API',
    cdn: DOCS_SCRIPT_PATH,
    withDefaultFonts: false,
    proxyUrl: '',
    showDeveloperTools: 'never' as const,
  }
  app.get('/docs', Scalar(docsPage))

  app.get('/widget/embed.js', (c) => {
    return c.body(embedScript, 200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
  })

  app.notFound((c) => jsonError(c, 404, 'NOT_FOUND', 'Not found'))

  app.onError((err, c) => {
    console.error(err)
    return jsonError(c, 500, 'INTERNAL', 'Internal error')
  })

  return app
}

export type ApiApp = ReturnType<typeof createApp>

function readCors(origin: string) {
  return cors({
    origin,
    allowMethods: ['GET', 'HEAD', 'OPTIONS'],
    maxAge: 86_400,
  })
}
