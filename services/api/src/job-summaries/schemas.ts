import { z } from '@hono/zod-openapi'

import { ErrorBodySchema } from '../schemas.ts'

const errorContent = {
  'application/json': {
    schema: ErrorBodySchema,
  },
} as const

export const JobSummaryAudioRequestSchema = z
  .object({
    jobId: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .openapi({ example: 'job-junior-accessibility-engineer' }),
    text: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .openapi({
        example:
          'Junior Accessibility Engineer in Addis Ababa. Full time. Apply by the end of December.',
      }),
    lang: z
      .string()
      .trim()
      .optional()
      .openapi({
        description: 'BCP-47 language. English only for AssemblyAI job summaries.',
        example: 'en',
      }),
  })
  .openapi('JobSummaryAudioRequest')

export const JobSummaryAudioResponseSchema = z
  .object({
    jobId: z.string(),
    textHash: z.string(),
    lang: z.string(),
    mime: z.string(),
    audioUrl: z.string(),
    cached: z.boolean(),
    provider: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('JobSummaryAudioResponse')

export const JobIdParamSchema = z.object({
  jobId: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .openapi({
      param: { name: 'jobId', in: 'path' },
      example: 'job-junior-accessibility-engineer',
    }),
})

export { errorContent }
