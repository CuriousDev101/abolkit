import { z } from '@hono/zod-openapi'

/** Liveness of this API process. Does not probe the external STT service. */
export const HealthSchema = z
  .object({
    ok: z.literal(true).openapi({ example: true }),
    service: z.literal('abolkit-api').openapi({ example: 'abolkit-api' }),
  })
  .openapi('Health')

/** Error body from docs-internal/architecture.md. */
export const ErrorBodySchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION' }),
      message: z.string().openapi({ example: 'Invalid request' }),
    }),
  })
  .openapi('ErrorBody')

export const AssetIdParamSchema = z.object({
  id: z
    .string()
    .uuid()
    .openapi({
      param: { name: 'id', in: 'path' },
      example: '11111111-1111-4111-8111-111111111111',
    }),
})

export const AssetUploadBodySchema = z
  .object({
    file: z.any().openapi({
      type: 'string',
      format: 'binary',
      description: 'Media file (video or audio). Field name must be `file`.',
    }),
    retentionDays: z.coerce.number().int().positive().max(365).optional().openapi({
      description: 'Days to retain the asset before it expires. Defaults to ASSET_RETENTION_DAYS.',
      example: 7,
    }),
  })
  .openapi('AssetUploadBody')

export const AssetCreatedSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '11111111-1111-4111-8111-111111111111' }),
  })
  .openapi('AssetCreated')

export const AssetSchema = z
  .object({
    id: z.string().uuid(),
    mime: z.string().openapi({ example: 'video/mp4' }),
    sizeBytes: z.number().int().nonnegative(),
    originalName: z.string().nullable().openapi({ example: 'lesson.mp4' }),
    retentionDays: z.number().int().positive(),
    createdAt: z.string().datetime().openapi({ example: '2026-11-14T18:00:00.000Z' }),
    expiresAt: z.string().datetime().openapi({ example: '2026-11-21T18:00:00.000Z' }),
    downloadUrl: z.string().openapi({
      description: 'Time-limited signed URL for the source object.',
      example: '/api/storage/object?key=assets%2F...&exp=...&sig=...',
    }),
    downloadUrlExpiresInSeconds: z.number().int().positive().openapi({ example: 3600 }),
  })
  .openapi('Asset')

export type Health = z.infer<typeof HealthSchema>
export type ErrorBody = z.infer<typeof ErrorBodySchema>
export type Asset = z.infer<typeof AssetSchema>
export type AssetCreated = z.infer<typeof AssetCreatedSchema>
