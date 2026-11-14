import { createRoute, z } from '@hono/zod-openapi'

import { ErrorBodySchema } from '../schemas.ts'

export const getStorageObjectRoute = createRoute({
  method: 'get',
  path: '/api/storage/object',
  operationId: 'getStorageObject',
  tags: ['Storage'],
  summary: 'Signed local-disk object download',
  description:
    'HMAC-verified download route used when STORAGE_PROVIDER=local-disk. ' +
    'MinIO adapters return presigned S3 URLs instead of this path.',
  request: {
    query: z.object({
      key: z.string().min(1).openapi({ example: 'assets/…/source' }),
      exp: z.coerce.number().int().positive().openapi({ example: 1731600000 }),
      sig: z.string().min(1).openapi({ example: 'abcdef…' }),
    }),
  },
  responses: {
    200: {
      description: 'Object bytes',
      content: {
        'application/octet-stream': {
          schema: z.any().openapi({ type: 'string', format: 'binary' }),
        },
      },
    },
    400: {
      description: 'Bad signature payload',
      content: { 'application/json': { schema: ErrorBodySchema } },
    },
    401: {
      description: 'Invalid or expired signature',
      content: { 'application/json': { schema: ErrorBodySchema } },
    },
    404: {
      description: 'Object missing',
      content: { 'application/json': { schema: ErrorBodySchema } },
    },
  },
})
