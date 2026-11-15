import { createRoute, type RouteConfig } from '@hono/zod-openapi'

import {
  AssetIdParamSchema,
  ErrorBodySchema,
  JobCreateBodySchema,
  JobIdParamSchema,
  JobSchema,
} from '../schemas.ts'

const errorContent = {
  'application/json': {
    schema: ErrorBodySchema,
  },
} as const

// Typed explicitly: an inline array literal here collapses c.req.valid() input types to never.
const writeSecurity: RouteConfig['security'] = [{ ApiKey: [] }, { Bearer: [] }]

export const createAssetJobRoute = createRoute({
  method: 'post',
  path: '/api/assets/{id}/jobs',
  operationId: 'createAssetJob',
  tags: ['Jobs'],
  summary: 'Queue a pipeline job for an asset',
  description:
    'Requires API_KEY. Inserts a `queued` job that the separate worker process claims. ' +
    'Failed attempts are retried with backoff up to `maxAttempts`. Poll `GET /api/jobs/{id}`.',
  security: writeSecurity,
  request: {
    params: AssetIdParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: JobCreateBodySchema,
        },
      },
    },
  },
  responses: {
    202: {
      description: 'Job queued',
      content: {
        'application/json': {
          schema: JobSchema,
        },
      },
    },
    400: { description: 'Validation error', content: errorContent },
    401: { description: 'Missing or invalid API key', content: errorContent },
    404: { description: 'Asset not found', content: errorContent },
    410: { description: 'Asset retention expired', content: errorContent },
    503: { description: 'API_KEY unset', content: errorContent },
  },
})

export const getJobRoute = createRoute({
  method: 'get',
  path: '/api/jobs/{id}',
  operationId: 'getJob',
  tags: ['Jobs'],
  summary: 'Job status, progress, error and result',
  request: {
    params: JobIdParamSchema,
  },
  responses: {
    200: {
      description: 'Job',
      content: {
        'application/json': {
          schema: JobSchema,
        },
      },
    },
    400: { description: 'Invalid id', content: errorContent },
    404: { description: 'Not found', content: errorContent },
  },
})
