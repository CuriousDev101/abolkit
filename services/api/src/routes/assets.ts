import { createRoute } from '@hono/zod-openapi'

import {
  AssetCreatedSchema,
  AssetIdParamSchema,
  AssetSchema,
  AssetUploadBodySchema,
  ErrorBodySchema,
} from '../schemas.ts'

const errorContent = {
  'application/json': {
    schema: ErrorBodySchema,
  },
} as const

export const createAssetRoute = createRoute({
  method: 'post',
  path: '/api/assets',
  operationId: 'createAsset',
  tags: ['Assets'],
  summary: 'Upload media',
  description:
    'Accepts multipart form field `file` (and optional `retentionDays`). ' +
    'Requires API_KEY. Stores bytes via the configured Storage adapter and returns `{ id }`.',
  security: [{ ApiKey: [] }, { Bearer: [] }],
  request: {
    body: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: AssetUploadBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Asset stored',
      content: {
        'application/json': {
          schema: AssetCreatedSchema,
        },
      },
    },
    400: { description: 'Validation error', content: errorContent },
    401: { description: 'Missing or invalid API key', content: errorContent },
    413: { description: 'File too large', content: errorContent },
    415: { description: 'MIME type not allowed', content: errorContent },
    503: { description: 'API_KEY unset', content: errorContent },
  },
})

export const getAssetRoute = createRoute({
  method: 'get',
  path: '/api/assets/{id}',
  operationId: 'getAsset',
  tags: ['Assets'],
  summary: 'Asset metadata and signed download URL',
  description:
    'Returns asset metadata plus a time-limited `downloadUrl`. ' +
    'Expired retention returns 410 Gone.',
  request: {
    params: AssetIdParamSchema,
  },
  responses: {
    200: {
      description: 'Asset metadata',
      content: {
        'application/json': {
          schema: AssetSchema,
        },
      },
    },
    400: { description: 'Invalid id', content: errorContent },
    404: { description: 'Not found', content: errorContent },
    410: { description: 'Retention expired', content: errorContent },
  },
})
