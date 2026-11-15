import { CAPTION_JOB_STATUSES, CAPTION_JOB_TYPES } from '@abolkit/caption-store'
import { z } from '@hono/zod-openapi'

const LANG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/

const VideoUrl = z.string().min(1).max(2048).openapi({
  description:
    'Video page or direct media URL (mp4, webm, …). YouTube links of any form (watch, youtu.be, embed, shorts) identify the same video.',
  example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
})

const Language = z.string().regex(LANG, 'language must be a code such as am, om, ti or aa')

const SourceLanguage = Language.optional().openapi({
  description:
    'Spoken language of the video. When set, the transcriber trusts this code. When omitted, the server uses ' +
    'CAPTION_DEFAULT_SOURCE_LANGUAGE (English).',
  example: 'en',
})

const TargetLanguages = z
  .array(Language)
  .max(16)
  .openapi({
    description: 'Translation targets, from TRANSLATION_LANGUAGES.',
    example: ['am', 'om', 'ti', 'aa'],
  })

export const TranscribeBodySchema = z
  .object({ url: VideoUrl, sourceLanguage: SourceLanguage })
  .openapi('CaptionTranscribeBody')

export const TranslateBodySchema = z
  .object({ url: VideoUrl, languages: TargetLanguages.min(1) })
  .openapi('CaptionTranslateBody')

export const GenerateBodySchema = z
  .object({
    url: VideoUrl,
    languages: TargetLanguages.optional().openapi({
      description:
        'Translation targets. Omit for every TRANSLATION_LANGUAGES entry; `[]` for the transcript only.',
    }),
    sourceLanguage: SourceLanguage,
  })
  .openapi('CaptionGenerateBody')

export const CaptionLookupQuerySchema = z.object({
  url: VideoUrl.openapi({ param: { name: 'url', in: 'query' } }),
})

export const VideoCaptionParamsSchema = z.object({
  id: z
    .string()
    .uuid()
    .openapi({
      param: { name: 'id', in: 'path' },
      example: '33333333-3333-4333-8333-333333333333',
    }),
  lang: Language.openapi({ param: { name: 'lang', in: 'path' }, example: 'am' }),
})

export const CaptionJobParamsSchema = z.object({
  id: z
    .string()
    .uuid()
    .openapi({
      param: { name: 'id', in: 'path' },
      example: '44444444-4444-4444-8444-444444444444',
    }),
})

export const CaptionJobSchema = z
  .object({
    id: z.string().uuid(),
    videoId: z.string().uuid(),
    type: z.enum(CAPTION_JOB_TYPES),
    language: z.string().nullable().openapi({ description: 'Target language of a translate job.' }),
    translateTo: z
      .array(z.string())
      .openapi({ description: 'Translations a transcribe job queues when done.' }),
    status: z.enum(CAPTION_JOB_STATUSES),
    progress: z.number().int().min(0).max(100),
    attempts: z.number().int().nonnegative(),
    error: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    startedAt: z.string().datetime().nullable(),
    finishedAt: z.string().datetime().nullable(),
  })
  .openapi('CaptionJob')

export const CaptionFileSchema = z
  .object({
    language: z.string().openapi({ example: 'am' }),
    kind: z.enum(['transcript', 'translation']),
    translatedFrom: z.string().nullable().openapi({ example: 'en' }),
    provider: z.string().openapi({ example: 'gemini' }),
    url: z.string().url().openapi({ description: 'WebVTT file (text/vtt).' }),
    cueCount: z.number().int().nonnegative(),
    needsReview: z
      .boolean()
      .openapi({ description: 'Machine output that a person has not checked yet.' }),
    updatedAt: z.string().datetime(),
  })
  .openapi('CaptionFile')

export const CaptionStatusSchema = z
  .object({
    status: z.enum(['ready', 'processing', 'failed']).openapi({
      description:
        '`processing` while any job is queued or running; `failed` when the newest job for a requested ' +
        'caption failed and that caption does not exist; otherwise `ready`.',
    }),
    video: z.object({
      id: z.string().uuid(),
      url: z.string().openapi({ description: 'Canonical URL that identifies the video.' }),
      sourceKind: z.enum(['youtube', 'file']),
      title: z.string().nullable(),
      durationSeconds: z.number().nullable(),
      sourceLanguage: z.string().nullable(),
    }),
    captions: z.array(CaptionFileSchema),
    jobs: z.array(CaptionJobSchema).openapi({ description: 'Newest job per type and language.' }),
  })
  .openapi('CaptionStatus')

export type CaptionStatusBody = z.infer<typeof CaptionStatusSchema>
export type CaptionJobBody = z.infer<typeof CaptionJobSchema>
