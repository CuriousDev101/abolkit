import { createRoute } from '@hono/zod-openapi'

import { HealthSchema } from '../schemas.ts'

export const healthRoute = createRoute({
  method: 'get',
  path: '/api/health',
  operationId: 'getHealth',
  tags: ['System'],
  summary: 'Liveness',
  description:
    'Reports that this API process is up. It does not call the speech-to-text service. ' +
    'That service is a separate MMS ASR wrapper reached only by the worker.',
  responses: {
    200: {
      description: 'This API process is up',
      content: {
        'application/json': {
          schema: HealthSchema,
        },
      },
    },
  },
})
