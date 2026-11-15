import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  loadCaptionConfig,
  type CaptionCache,
  type CaptionJobRecord,
  type CaptionJobType,
  type CaptionRepository,
  type CaptionWithVtt,
  type VideoRecord,
} from '@abolkit/caption-store'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from './app.ts'
import type { CaptionBackend } from './captions/service.ts'
import { openDatabase } from './db/sqlite.ts'

const YT = 'https://youtu.be/dQw4w9WgXcQ'
const CANONICAL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const VTT = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000 needsReview\nHello\n'

function memoryBackend(env: Record<string, string> = {}) {
  const videos: VideoRecord[] = []
  const captions: CaptionWithVtt[] = []
  const jobs: CaptionJobRecord[] = []
  const enqueued: Array<{ type: CaptionJobType; id: string }> = []
  const hits = new Map<string, number>()
  const now = () => new Date('2026-11-15T12:00:00Z')
  const active = (j: CaptionJobRecord) => j.status === 'queued' || j.status === 'running'

  const repo: CaptionRepository = {
    async upsertVideo(identity, sourceUrl) {
      let video = videos.find((v) => v.url === identity.url)
      if (!video) {
        video = {
          id: randomUUID(),
          url: identity.url,
          sourceUrl,
          sourceKind: identity.kind,
          title: null,
          durationSeconds: null,
          sourceLanguage: null,
          createdAt: now(),
          updatedAt: now(),
        }
        videos.push(video)
      }
      return video
    },
    findVideoByUrl: async (url) => videos.find((v) => v.url === url) ?? null,
    getVideo: async (id) => videos.find((v) => v.id === id) ?? null,
    listCaptions: async (videoId) => captions.filter((c) => c.videoId === videoId),
    getCaption: async (videoId, language) =>
      captions.find((c) => c.videoId === videoId && c.language === language) ?? null,
    getTranscript: async (videoId) =>
      captions.find((c) => c.videoId === videoId && c.kind === 'transcript') ?? null,
    async createJob(input) {
      const existing = jobs.find(
        (j) =>
          j.videoId === input.videoId &&
          j.type === input.type &&
          (j.language ?? '') === (input.language ?? '') &&
          active(j),
      )
      if (existing) {
        for (const lang of input.translateTo ?? []) {
          if (!existing.translateTo.includes(lang)) existing.translateTo.push(lang)
        }
        return { job: existing, created: false }
      }
      const job: CaptionJobRecord = {
        id: randomUUID(),
        videoId: input.videoId,
        type: input.type,
        language: input.language ?? null,
        translateTo: [...(input.translateTo ?? [])],
        sourceLanguage: input.sourceLanguage ?? null,
        status: 'queued',
        progress: 0,
        attempts: 0,
        error: null,
        createdAt: now(),
        updatedAt: now(),
        startedAt: null,
        finishedAt: null,
      }
      jobs.push(job)
      return { job, created: true }
    },
    getJob: async (id) => jobs.find((j) => j.id === id) ?? null,
    listLatestJobs: async (videoId) => jobs.filter((j) => j.videoId === videoId),
    async failJob(id, error, final) {
      const job = jobs.find((j) => j.id === id)!
      job.status = final ? 'failed' : 'queued'
      job.error = error
    },
  }

  const cache: CaptionCache = {
    getVtt: async () => null,
    setVtt: async () => {},
    getVideoId: async () => null,
    setVideoId: async () => {},
    getCaptionList: async () => null,
    setCaptionList: async () => {},
    invalidateVideo: async () => {},
  }

  const backend: CaptionBackend = {
    config: loadCaptionConfig({
      POSTGRES_URL: 'postgres://test',
      REDIS_URL: 'redis://test',
      ...env,
    }),
    repo,
    cache,
    queues: {
      async enqueue(type, data) {
        if (!enqueued.some((e) => e.id === data.captionJobId))
          enqueued.push({ type, id: data.captionJobId })
      },
      close: async () => {},
    },
    rateLimiter: {
      async hit(bucket, key, limit) {
        const count = (hits.get(`${bucket}:${key}`) ?? 0) + 1
        hits.set(`${bucket}:${key}`, count)
        return {
          allowed: count <= limit,
          limit,
          remaining: Math.max(0, limit - count),
          resetSeconds: 30,
        }
      },
    },
    ready: async () => {},
  }

  /** What the worker does when a transcript is stored. */
  function finishTranscript(videoId: string, language = 'en') {
    for (const job of jobs)
      if (job.videoId === videoId && job.type === 'transcribe') job.status = 'succeeded'
    captions.push({
      id: randomUUID(),
      videoId,
      language,
      kind: 'transcript',
      translatedFrom: null,
      provider: 'stub',
      providerRef: null,
      storageKey: `videos/${videoId}/captions/${language}.vtt`,
      url: `/api/videos/${videoId}/captions/${language}`,
      vtt: VTT,
      cueCount: 1,
      needsReview: true,
      createdAt: now(),
      updatedAt: now(),
    })
  }

  return { backend, videos, jobs, enqueued, finishTranscript }
}

let root: string
let mem: ReturnType<typeof memoryBackend>
let app: ReturnType<typeof createApp>

function build(env: Record<string, string> = {}) {
  mem = memoryBackend(env)
  app = createApp({
    db: openDatabase(':memory:'),
    captions: mem.backend,
    env: {
      API_KEY: 'test-key',
      STORAGE_PROVIDER: 'local-disk',
      STORAGE_LOCAL_ROOT: join(root, 'storage'),
      STORAGE_SIGNING_SECRET: 'secret',
      PUBLIC_BASE_URL: 'https://api.example.org',
    },
  })
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'abolkit-captions-'))
  build()
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/captions/generate', () => {
  it('is public, identifies the video by canonical URL and queues one transcribe job with all targets', async () => {
    const res = await post('/api/captions/generate', { url: YT })
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.status).toBe('processing')
    expect(body.video.url).toBe(CANONICAL)
    expect(body.jobs).toHaveLength(1)
    expect(body.jobs[0]).toMatchObject({
      type: 'transcribe',
      translateTo: ['am', 'om', 'ti', 'aa'],
    })
    expect(mem.enqueued).toEqual([{ type: 'transcribe', id: body.jobs[0].id }])
  })

  it('joins the running job when the same video is requested again under another URL', async () => {
    await post('/api/captions/generate', { url: YT, languages: ['am'] })
    const res = await post('/api/captions/generate', {
      url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      languages: ['ti'],
    })
    expect(res.status).toBe(202)
    expect(mem.videos).toHaveLength(1)
    expect(mem.jobs).toHaveLength(1)
    expect(mem.jobs[0]!.translateTo).toEqual(['am', 'ti'])
  })

  it('queues only the missing translations once a transcript exists', async () => {
    await post('/api/captions/generate', { url: YT, languages: [] })
    mem.finishTranscript(mem.videos[0]!.id)
    const res = await post('/api/captions/generate', { url: YT, languages: ['am', 'aa'] })
    const body = await res.json()
    expect(res.status).toBe(202)
    const translate = body.jobs.filter((j: { type: string }) => j.type === 'translate')
    expect(translate.map((j: { language: string }) => j.language)).toEqual(['am', 'aa'])
    expect(body.captions[0].url).toBe(
      `https://api.example.org/api/videos/${mem.videos[0]!.id}/captions/en`,
    )
  })

  it('accepts direct media URLs by default and rejects unsupported languages', async () => {
    const file = await post('/api/captions/generate', {
      url: 'https://cdn.example.org/lesson.mp4',
      languages: [],
    })
    expect(file.status).toBe(202)
    expect((await file.json()).video.sourceKind).toBe('file')

    const lang = await post('/api/captions/generate', { url: YT, languages: ['fr'] })
    expect(lang.status).toBe(400)
    expect((await lang.json()).error.code).toBe('UNSUPPORTED_LANGUAGE')
  })

  it('rejects hosts outside a restricted CAPTION_ALLOWED_HOSTS list', async () => {
    build({ CAPTION_ALLOWED_HOSTS: 'youtube.com,youtu.be' })
    const host = await post('/api/captions/generate', { url: 'https://evil.example/a.mp4' })
    expect(host.status).toBe(400)
    expect((await host.json()).error.code).toBe('HOST_NOT_ALLOWED')
  })
})

describe('POST /api/captions/transcribe and /translate', () => {
  it('transcribe returns 200 without a job when the transcript exists', async () => {
    await post('/api/captions/transcribe', { url: YT })
    mem.finishTranscript(mem.videos[0]!.id)
    const res = await post('/api/captions/transcribe', { url: YT })
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('ready')
  })

  it('translate answers 409 when there is no transcript and nothing running', async () => {
    const res = await post('/api/captions/translate', { url: YT, languages: ['am'] })
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('NO_SOURCE_CAPTION')
  })

  it('translate joins a running transcribe job', async () => {
    await post('/api/captions/transcribe', { url: YT })
    const res = await post('/api/captions/translate', { url: YT, languages: ['om'] })
    expect(res.status).toBe(202)
    expect(mem.jobs[0]!.translateTo).toEqual(['om'])
  })

  it('translate skips the language the video is spoken in', async () => {
    await post('/api/captions/transcribe', { url: YT })
    mem.finishTranscript(mem.videos[0]!.id, 'am')
    const res = await post('/api/captions/translate', { url: YT, languages: ['am'] })
    expect(res.status).toBe(200)
    expect(mem.jobs.filter((j) => j.type === 'translate')).toHaveLength(0)
  })
})

describe('caption reads', () => {
  it('looks up by any URL form and serves WebVTT', async () => {
    expect((await app.request(`/api/captions?url=${encodeURIComponent(YT)}`)).status).toBe(404)
    await post('/api/captions/transcribe', { url: YT })
    const id = mem.videos[0]!.id
    mem.finishTranscript(id)

    const lookup = await app.request(`/api/captions?url=${encodeURIComponent(CANONICAL + '&t=3')}`)
    expect(lookup.status).toBe(200)
    expect((await lookup.json()).captions).toHaveLength(1)

    const vtt = await app.request(`/api/videos/${id}/captions/en`)
    expect(vtt.status).toBe(200)
    expect(vtt.headers.get('content-type')).toContain('text/vtt')
    expect(await vtt.text()).toBe(VTT)
    expect((await app.request(`/api/videos/${id}/captions/am`)).status).toBe(404)
  })

  it('reports a job by id', async () => {
    const body = await (await post('/api/captions/transcribe', { url: YT })).json()
    const res = await app.request(`/api/caption-jobs/${body.jobs[0].id}`)
    expect(res.status).toBe(200)
    expect((await res.json()).type).toBe('transcribe')
  })
})

describe('limits and configuration', () => {
  it('rate limits job requests per IP', async () => {
    build({ RATE_LIMIT_JOB_REQUESTS: '2' })
    expect((await post('/api/captions/transcribe', { url: YT })).status).toBe(202)
    expect((await post('/api/captions/transcribe', { url: YT })).status).toBe(202)
    const limited = await post('/api/captions/transcribe', { url: YT })
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('30')
  })

  it('answers 503 when captions are not configured', async () => {
    const off = createApp({
      db: openDatabase(':memory:'),
      captions: null,
      env: { API_KEY: 'k', STORAGE_LOCAL_ROOT: join(root, 'storage'), STORAGE_SIGNING_SECRET: 's' },
    })
    const res = await off.request('/api/captions/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: YT }),
    })
    expect(res.status).toBe(503)
    expect((await res.json()).error.code).toBe('CAPTIONS_DISABLED')
  })

  it('still requires the API key for other writes', async () => {
    const res = await app.request('/api/assets/11111111-1111-4111-8111-111111111111/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'transcribe' }),
    })
    expect(res.status).toBe(401)
  })
})
