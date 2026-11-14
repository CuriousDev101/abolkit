import { createStorage, verifyLocalDiskSignedUrl, type Storage } from '@abolkit/provider-sdk'
import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import type { DatabaseSync } from 'node:sqlite'

import { AssetServiceError, createAssetService, type AssetService } from './assets/service.ts'
import { loadApiConfig, type ApiConfig } from './config.ts'
import { openDatabase } from './db/sqlite.ts'
import { embedScript } from './embed.ts'
import { jsonError, validationHook } from './http.ts'
import { requireApiKey } from './middleware/api-key.ts'
import { openApiConfig } from './openapi.ts'
import { createAssetRoute, getAssetRoute } from './routes/assets.ts'
import { healthRoute } from './routes/health.ts'
import { getStorageObjectRoute } from './routes/storage-object.ts'
import { loadScalarStandalone } from './scalar-asset.ts'
import { ErrorBodySchema } from './schemas.ts'

const DOCS_SCRIPT_PATH = '/docs/scalar.js'

export type CreateAppOptions = {
  env?: Record<string, string | undefined>
  /** Injected in tests. */
  db?: DatabaseSync
  storage?: Storage
}

/**
 * Hono + zod-openapi API (#17 skeleton + #24 assets/storage).
 * POST /api/assets uses requireApiKey; GET metadata and signed downloads stay open.
 */
export function createApp(options: CreateAppOptions | Record<string, string | undefined> = {}) {
  const env = isEnvMap(options) ? options : (options.env ?? process.env)
  const config = loadApiConfig(env)
  const db = (!isEnvMap(options) && options.db) || openDatabase(config.databaseUrl)
  const storage =
    (!isEnvMap(options) && options.storage) ||
    createStorage({
      storage: config.storageProvider,
      env: config.env,
      publicBaseUrl: config.publicBaseUrl,
    })
  const assets = createAssetService({ db, storage, config })

  const scalarJs = loadScalarStandalone()
  const app = new OpenAPIHono({ defaultHook: validationHook })

  app.openAPIRegistry.register('ErrorBody', ErrorBodySchema)
  app.openAPIRegistry.registerComponent('securitySchemes', 'ApiKey', {
    type: 'apiKey',
    in: 'header',
    name: 'X-API-Key',
  })
  app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'API key',
  })

  app.use('*', apiCors(config.corsOrigin))

  // Only the upload write needs the API key. GET /api/assets/:id stays public.
  app.use('/api/assets', async (c, next) => {
    if (c.req.method !== 'POST') return next()
    return requireApiKey(config.apiKey)(c, next)
  })

  app.openapi(healthRoute, (c) => {
    return c.json({ ok: true, service: 'abolkit-api' }, 200)
  })

  registerAssetRoutes(app, config, assets, storage)

  app.doc31('/openapi.json', openApiConfig)

  app.get('/docs/scalar.js', (c) => {
    return c.body(scalarJs, 200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    })
  })

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
    if (err instanceof AssetServiceError) {
      return jsonError(c, err.status, err.code, err.message)
    }
    console.error(err)
    return jsonError(c, 500, 'INTERNAL', 'Internal error')
  })

  return app
}

export type ApiApp = ReturnType<typeof createApp>

function registerAssetRoutes(
  app: OpenAPIHono,
  config: ApiConfig,
  assets: AssetService,
  storage: Storage,
) {
  app.openapi(createAssetRoute, async (c) => {
    const body = await c.req.parseBody({ all: true })
    const filePart = body.file
    if (!(filePart instanceof File)) {
      throw new AssetServiceError(400, 'VALIDATION', 'multipart field "file" is required')
    }

    const retentionRaw = body.retentionDays
    const retentionDays =
      retentionRaw == null || retentionRaw === ''
        ? undefined
        : Number(Array.isArray(retentionRaw) ? retentionRaw[0] : retentionRaw)

    if (retentionDays !== undefined && (!Number.isInteger(retentionDays) || retentionDays <= 0)) {
      throw new AssetServiceError(400, 'VALIDATION', 'retentionDays must be a positive integer')
    }

    const data = new Uint8Array(await filePart.arrayBuffer())
    const created = await assets.upload(
      {
        data,
        mime: filePart.type || 'application/octet-stream',
        originalName: filePart.name || null,
        sizeBytes: data.byteLength,
      },
      retentionDays,
    )
    return c.json(created, 201)
  })

  app.openapi(getAssetRoute, async (c) => {
    const { id } = c.req.valid('param')
    const asset = await assets.get(id)
    return c.json(asset, 200)
  })

  app.openapi(getStorageObjectRoute, async (c) => {
    const { key, exp, sig } = c.req.valid('query')
    const secret = config.env.STORAGE_SIGNING_SECRET?.trim()
    if (!secret || !verifyLocalDiskSignedUrl(secret, key, exp, sig)) {
      return jsonError(c, 401, 'UNAUTHORIZED', 'Invalid or expired signed URL')
    }

    const object = await storage.get(key)
    if (!object) {
      return jsonError(c, 404, 'NOT_FOUND', 'Object not found')
    }

    const bytes = Buffer.from(object.bytes)
    return c.body(bytes, 200, {
      'Content-Type': object.mime,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    })
  })
}

function isEnvMap(
  value: CreateAppOptions | Record<string, string | undefined>,
): value is Record<string, string | undefined> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !('env' in value) &&
    !('db' in value) &&
    !('storage' in value)
  )
}

function apiCors(origin: string) {
  return cors({
    origin,
    allowMethods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'],
    allowHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
    maxAge: 86_400,
  })
}
