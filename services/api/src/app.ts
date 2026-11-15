import { enqueueJob, getJob, type Job } from '@abolkit/jobs'
import { createStorage, verifyLocalDiskSignedUrl, type Storage } from '@abolkit/provider-sdk'
import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import type { DatabaseSync } from 'node:sqlite'

import { AssetServiceError, createAssetService, type AssetService } from './assets/service.ts'
import { loadApiConfig, type ApiConfig } from './config.ts'
import { getAssetById, isExpired } from './db/assets.ts'
import { openDatabase } from './db/sqlite.ts'
import { embedScript } from './embed.ts'
import { HttpError, jsonError, validationHook } from './http.ts'
import { requireApiKey } from './middleware/api-key.ts'
import { openApiConfig } from './openapi.ts'
import { createAssetRoute, getAssetRoute } from './routes/assets.ts'
import { healthRoute } from './routes/health.ts'
import { createAssetJobRoute, getJobRoute } from './routes/jobs.ts'
import { getStorageObjectRoute } from './routes/storage-object.ts'
import { loadScalarStandalone } from './scalar-asset.ts'
import { ErrorBodySchema, type JobBody } from './schemas.ts'

const DOCS_SCRIPT_PATH = '/docs/scalar.js'
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export type CreateAppOptions = {
  env?: Record<string, string | undefined>
  /** Injected in tests. */
  db?: DatabaseSync
  storage?: Storage
}

/**
 * Hono + zod-openapi API (#17 skeleton, #24 assets/storage, #25 jobs).
 * Writes under /api use requireApiKey; GET metadata, job status and signed downloads stay open.
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

  // Writes (upload, job create, later caption puts) need the API key. Reads stay public.
  app.use('/api/*', async (c, next) => {
    if (!WRITE_METHODS.has(c.req.method)) return next()
    return requireApiKey(config.apiKey)(c, next)
  })

  app.openapi(healthRoute, (c) => {
    return c.json({ ok: true, service: 'abolkit-api' }, 200)
  })

  registerAssetRoutes(app, config, assets, storage)
  registerJobRoutes(app, config, db)

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
    if (err instanceof AssetServiceError || err instanceof HttpError) {
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

function registerJobRoutes(app: OpenAPIHono, config: ApiConfig, db: DatabaseSync) {
  app.openapi(createAssetJobRoute, (c) => {
    const { id } = c.req.valid('param')
    const { type, params } = c.req.valid('json')

    const asset = getAssetById(db, id)
    if (!asset) {
      throw new HttpError(404, 'NOT_FOUND', 'Asset not found')
    }
    if (isExpired(asset)) {
      throw new HttpError(410, 'GONE', 'Asset retention has expired')
    }

    const job = enqueueJob(db, { assetId: id, type, params, maxAttempts: config.jobMaxAttempts })
    c.header('Location', `/api/jobs/${job.id}`)
    return c.json(toJobBody(job), 202)
  })

  app.openapi(getJobRoute, (c) => {
    const { id } = c.req.valid('param')
    const job = getJob(db, id)
    if (!job) {
      throw new HttpError(404, 'NOT_FOUND', 'Job not found')
    }
    c.header('Cache-Control', 'no-store')
    return c.json(toJobBody(job), 200)
  })
}

function toJobBody(job: Job): JobBody {
  return {
    id: job.id,
    assetId: job.assetId,
    type: job.type,
    status: job.status,
    progress: job.progress,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    error: job.error,
    params: job.params,
    result: job.result,
    nextAttemptAt: job.status === 'queued' ? job.runAfter : null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  }
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
