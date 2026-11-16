import { z } from '@hono/zod-openapi'

import { ErrorBodySchema } from '../schemas.ts'

export const JobPostingResolveQuerySchema = z
  .object({
    url: z
      .string()
      .min(1)
      .max(2048)
      .openapi({
        description: 'Absolute http(s) JobPosting JSON URL or HTML career page URL',
        example: 'https://example.org/jobs/junior-accessibility-engineer',
      }),
  })
  .openapi('JobPostingResolveQuery')

export const JobPostingResolveResponseSchema = z
  .object({
    sourceUrl: z.string().url(),
    extractedFrom: z.enum(['json', 'json-ld', 'html']),
    job: z.record(z.string(), z.unknown()).openapi({
      description: 'Clean schema.org/JobPosting JSON-LD object',
    }),
  })
  .openapi('JobPostingResolveResponse')

export const errorContent = {
  'application/json': {
    schema: ErrorBodySchema,
  },
} as const
