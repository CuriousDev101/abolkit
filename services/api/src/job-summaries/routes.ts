import { createRoute } from '@hono/zod-openapi'

import {
  errorContent,
  JobIdParamSchema,
  JobSummaryAudioRequestSchema,
  JobSummaryAudioResponseSchema,
} from './schemas.ts'

export const ensureJobSummaryAudioRoute = createRoute({
  method: 'post',
  path: '/api/job-summaries/audio',
  operationId: 'ensureJobSummaryAudio',
  tags: ['Job summaries'],
  summary: 'Ensure a job-card audio summary exists',
  description:
    'Synthesizes a short English audio summary with the configured TTS provider (AssemblyAI). ' +
    'Audio is generated once per jobId + text hash and reused until the summary text changes. ' +
    'Public (no API key); intended for `<abol-job-card audio-summary-api>`.',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: JobSummaryAudioRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Audio ready (newly generated or cached)',
      content: {
        'application/json': {
          schema: JobSummaryAudioResponseSchema,
        },
      },
    },
    400: { description: 'Validation error', content: errorContent },
    503: { description: 'TTS or database unavailable', content: errorContent },
  },
})

export const getJobSummaryAudioRoute = createRoute({
  method: 'get',
  path: '/api/job-summaries/{jobId}',
  operationId: 'getJobSummaryAudio',
  tags: ['Job summaries'],
  summary: 'Get stored job-card audio summary metadata',
  description:
    'Returns the cached audio URL for a job id when one has already been generated. ' +
    'Does not call TTS.',
  request: {
    params: JobIdParamSchema,
  },
  responses: {
    200: {
      description: 'Cached audio summary',
      content: {
        'application/json': {
          schema: JobSummaryAudioResponseSchema,
        },
      },
    },
    404: { description: 'No audio stored for this job yet', content: errorContent },
    503: { description: 'Database unavailable', content: errorContent },
  },
})
