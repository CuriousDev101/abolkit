import { createRoute, z } from '@hono/zod-openapi'

import { ErrorBodySchema } from '../schemas.ts'
import {
  CaptionJobParamsSchema,
  CaptionJobSchema,
  CaptionLookupQuerySchema,
  CaptionStatusSchema,
  GenerateBodySchema,
  TranscribeBodySchema,
  TranslateBodySchema,
  VideoCaptionParamsSchema,
} from './schemas.ts'

const errorContent = { 'application/json': { schema: ErrorBodySchema } } as const
const statusContent = { 'application/json': { schema: CaptionStatusSchema } } as const

const commonErrors = {
  400: {
    description: 'Invalid URL, unsupported language or host not allowed',
    content: errorContent,
  },
  429: { description: 'Too many requests from this IP', content: errorContent },
  503: {
    description: 'Captions are not configured (POSTGRES_URL / REDIS_URL) or the queue is down',
    content: errorContent,
  },
}

const postResponses = {
  200: { description: 'Every requested caption already exists', content: statusContent },
  202: {
    description: 'Jobs queued or already running; poll GET /api/captions?url=',
    content: statusContent,
  },
  ...commonErrors,
}

const jsonBody = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { 'application/json': { schema } },
})

const PUBLIC_NOTE =
  'Public (no API key), rate limited per IP. Hosts are limited by CAPTION_ALLOWED_HOSTS (`*` allows any). ' +
  'Repeated requests for the same video join the running job instead of starting another.'

export const transcribeRoute = createRoute({
  method: 'post',
  path: '/api/captions/transcribe',
  operationId: 'transcribeVideo',
  tags: ['Captions'],
  summary: 'Generate the WebVTT transcript for a video URL',
  description: `Extracts the audio and runs the configured transcriber (TRANSCRIBER). ${PUBLIC_NOTE}`,
  request: { body: jsonBody(TranscribeBodySchema) },
  responses: postResponses,
})

export const translateRoute = createRoute({
  method: 'post',
  path: '/api/captions/translate',
  operationId: 'translateCaptions',
  tags: ['Captions'],
  summary: 'Translate an existing transcript, keeping every timestamp',
  description:
    'Needs a transcript (or a running transcribe job, which these languages then join). Only cue text is ' +
    `sent to the translator; start and end times are copied from the transcript. ${PUBLIC_NOTE}`,
  request: { body: jsonBody(TranslateBodySchema) },
  responses: {
    ...postResponses,
    409: {
      description: 'No transcript yet; call transcribe or generate first',
      content: errorContent,
    },
  },
})

export const generateRoute = createRoute({
  method: 'post',
  path: '/api/captions/generate',
  operationId: 'generateCaptions',
  tags: ['Captions'],
  summary: 'Transcribe and translate in one request',
  description: `Transcribes if needed, then queues each missing translation. ${PUBLIC_NOTE}`,
  request: { body: jsonBody(GenerateBodySchema) },
  responses: postResponses,
})

export const lookupRoute = createRoute({
  method: 'get',
  path: '/api/captions',
  operationId: 'getVideoCaptions',
  tags: ['Captions'],
  summary: 'Captions and job progress for a video URL',
  request: { query: CaptionLookupQuerySchema },
  responses: {
    200: { description: 'Video, caption files and newest jobs', content: statusContent },
    404: { description: 'No captions were ever requested for this video', content: errorContent },
    ...commonErrors,
  },
})

export const vttRoute = createRoute({
  method: 'get',
  path: '/api/videos/{id}/captions/{lang}',
  operationId: 'getCaptionVtt',
  tags: ['Captions'],
  summary: 'One caption file as WebVTT',
  description: 'Served from the Redis cache, falling back to Postgres.',
  request: { params: VideoCaptionParamsSchema },
  responses: {
    200: {
      description: 'WebVTT document',
      content: {
        'text/vtt': {
          schema: z.string().openapi({ example: 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nሰላም' }),
        },
      },
    },
    404: { description: 'No caption in this language', content: errorContent },
    ...commonErrors,
  },
})

export const captionJobRoute = createRoute({
  method: 'get',
  path: '/api/caption-jobs/{id}',
  operationId: 'getCaptionJob',
  tags: ['Captions'],
  summary: 'Status of one caption job',
  request: { params: CaptionJobParamsSchema },
  responses: {
    200: { description: 'Job', content: { 'application/json': { schema: CaptionJobSchema } } },
    404: { description: 'Not found', content: errorContent },
    ...commonErrors,
  },
})
