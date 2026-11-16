import { createRoute } from '@hono/zod-openapi'

import {
  errorContent,
  JobPostingResolveQuerySchema,
  JobPostingResolveResponseSchema,
} from './schemas.ts'

export const resolveJobPostingRoute = createRoute({
  method: 'get',
  path: '/api/job-postings/resolve',
  operationId: 'resolveJobPosting',
  tags: ['Job postings'],
  summary: 'Resolve a JobPosting URL for <abol-job-card>',
  description:
    'Fetches a job URL server-side (avoids browser CORS), then returns a clean schema.org/JobPosting. ' +
    'Accepts JSON/JSON-LD files and HTML pages — with or without embedded JSON-LD (HTML is scraped). ' +
    'Public (no API key).',
  request: {
    query: JobPostingResolveQuerySchema,
  },
  responses: {
    200: {
      description: 'Normalized JobPosting JSON-LD',
      content: {
        'application/json': {
          schema: JobPostingResolveResponseSchema,
        },
      },
    },
    400: { description: 'Invalid or blocked URL / unusable page', content: errorContent },
    502: { description: 'Upstream fetch failed', content: errorContent },
  },
})
