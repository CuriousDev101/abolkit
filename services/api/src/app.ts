import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import type { ZodError } from 'zod'

import { loadApiConfig } from './config.ts'
import { embedScript } from './embed.ts'
import { openApiConfig } from './openapi.ts'
import { healthRoute } from './routes/health.ts'
import { loadScalarStandalone } from './scalar-asset.ts'
import type { ErrorBody } from './schemas.ts'

const DOCS_SCRIPT_PATH = '/docs/scalar.js'

export function createApp(env: Record<string, string | undefined> = process.env) {
  const config = loadApiConfig(env)
  const scalarJs = loadScalarStandalone()
  const app = new OpenAPIHono({ defaultHook: validationHook })

  // Reads are open. Write routes (#17) are not mounted here and will require an API key.
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

  app.notFound((c) => {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } } satisfies ErrorBody, 404)
  })

  app.onError((err, c) => {
    console.error(err)
    return c.json(
      { error: { code: 'INTERNAL', message: 'Internal error' } } satisfies ErrorBody,
      500,
    )
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

function validationHook(
  result: { success: true; data: unknown } | { success: false; error: ZodError },
  c: Context,
) {
  if (result.success) return
  const message = result.error.issues.map((issue) => issue.message).join('; ')
  return c.json(
    { error: { code: 'VALIDATION', message: message || 'Invalid request' } } satisfies ErrorBody,
    400,
  )
}
